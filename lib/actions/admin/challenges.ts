"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/session";
import { awardAchievement } from "@/lib/achievements";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db/prisma";
import { fromDateTimeLocalValue } from "@/lib/utils";
import { challengeSchema, questionsSchema, reviewSchema, rewardSchema } from "@/lib/validations/admin";
import { actionError, UserFacingError, type ActionResult } from "../result";
import { nullable, uniqueSlug } from "./helpers";

const idSchema = z.string().min(1).max(40);

function revalidateChallenges(slug?: string) {
  revalidatePath("/challenge");
  if (slug) revalidatePath(`/challenge/${slug}`);
  revalidatePath("/super-admin/challenges", "layout");
}

export async function saveChallenge(id: string | null, input: z.input<typeof challengeSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await assertAdmin();
    const data = challengeSchema.parse(input);
    const startsAt = fromDateTimeLocalValue(data.startsAt);
    const endsAt = fromDateTimeLocalValue(data.endsAt);
    if (!startsAt || !endsAt) throw new UserFacingError("Sanalar noto‘g‘ri");
    if (endsAt <= startsAt) throw new UserFacingError("Tugash vaqti boshlanish vaqtidan keyin bo‘lishi kerak");

    if (id) {
      const existing = await prisma.challenge.findUnique({ where: { id: idSchema.parse(id) }, select: { type: true, _count: { select: { submissions: true } } } });
      if (!existing) throw new UserFacingError("Challenge topilmadi");
      if (existing._count.submissions > 0 && existing.type !== data.type) {
        throw new UserFacingError("Topshiriqlar mavjud — challenge turini o‘zgartirib bo‘lmaydi");
      }
    }

    const slug = await uniqueSlug("challenge", data.slug, data.title, id ?? undefined);
    const payload = {
      title: data.title,
      slug,
      summary: data.summary,
      description: data.description,
      type: data.type,
      objectives: data.objectives,
      requirements: data.requirements,
      startsAt,
      endsAt,
      maxScore: data.maxScore,
      passingScore: data.passingScore,
      allowAttachment: data.allowAttachment,
      showLeaderboard: data.showLeaderboard,
    };
    const saved = id
      ? await prisma.challenge.update({ where: { id }, data: payload })
      : await prisma.challenge.create({ data: { ...payload, createdById: admin.id } });
    await audit({ actorId: admin.id, action: id ? "challenge.update" : "challenge.create", targetType: "Challenge", targetId: saved.id, summary: data.title });
    revalidateChallenges(saved.slug);
    return { ok: true, data: { id: saved.id }, message: "Challenge saqlandi" };
  } catch (err) {
    return actionError(err);
  }
}

export async function setChallengeStatus(id: string, status: "DRAFT" | "PUBLISHED" | "CLOSED"): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    z.enum(["DRAFT", "PUBLISHED", "CLOSED"]).parse(status);
    const ch = await prisma.challenge.findUnique({
      where: { id: idSchema.parse(id) },
      select: { slug: true, title: true, type: true, status: true, _count: { select: { questions: true, submissions: true } } },
    });
    if (!ch) throw new UserFacingError("Challenge topilmadi");
    if (ch.status === "RESULTS_PUBLISHED") throw new UserFacingError("Natijalar e’lon qilingan challenge holatini o‘zgartirib bo‘lmaydi");
    if (status === "PUBLISHED" && ch.type === "QUIZ" && ch._count.questions === 0) throw new UserFacingError("Testni e’lon qilishdan oldin savollar qo‘shing");
    if (status === "DRAFT" && ch._count.submissions > 0) throw new UserFacingError("Topshiriqlar bor — qoralamaga qaytarib bo‘lmaydi");
    await prisma.challenge.update({ where: { id }, data: { status } });
    await audit({ actorId: admin.id, action: "challenge.status", targetType: "Challenge", targetId: id, summary: `${ch.title}: ${status}` });
    revalidateChallenges(ch.slug);
    return { ok: true, message: "Holat yangilandi" };
  } catch (err) {
    return actionError(err);
  }
}

export async function deleteChallenge(id: string): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const ch = await prisma.challenge.findUnique({ where: { id: idSchema.parse(id) }, select: { title: true, _count: { select: { submissions: true } } } });
    if (!ch) throw new UserFacingError("Challenge topilmadi");
    if (ch._count.submissions > 0) throw new UserFacingError("Topshiriqlar mavjud challenge’ni o‘chirib bo‘lmaydi. Uning o‘rniga yoping.");
    await prisma.challenge.delete({ where: { id } });
    await audit({ actorId: admin.id, action: "challenge.delete", targetType: "Challenge", targetId: id, summary: ch.title });
    revalidateChallenges();
    return { ok: true, message: "Challenge o‘chirildi" };
  } catch (err) {
    return actionError(err);
  }
}

export async function saveQuestions(challengeId: string, input: z.input<typeof questionsSchema>): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const data = questionsSchema.parse(input);
    const ch = await prisma.challenge.findUnique({
      where: { id: idSchema.parse(challengeId) },
      select: { type: true, slug: true, title: true, _count: { select: { submissions: true } } },
    });
    if (!ch) throw new UserFacingError("Challenge topilmadi");
    if (ch.type !== "QUIZ") throw new UserFacingError("Savollar faqat test turidagi challenge uchun");
    if (ch._count.submissions > 0) throw new UserFacingError("Topshiriqlar bor — baholash adolatli qolishi uchun savollarni o‘zgartirib bo‘lmaydi");
    await prisma.$transaction([
      prisma.challengeQuestion.deleteMany({ where: { challengeId } }),
      prisma.challengeQuestion.createMany({
        data: data.questions.map((q, i) => ({
          challengeId,
          order: i,
          prompt: q.prompt,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: nullable(q.explanation),
          points: q.points,
        })),
      }),
    ]);
    await audit({ actorId: admin.id, action: "challenge.update", targetType: "Challenge", targetId: challengeId, summary: `${ch.title}: ${data.questions.length} ta savol` });
    revalidateChallenges(ch.slug);
    return { ok: true, message: "Savollar saqlandi" };
  } catch (err) {
    return actionError(err);
  }
}

export async function saveReward(challengeId: string, rewardId: string | null, input: z.input<typeof rewardSchema>): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const data = rewardSchema.parse(input);
    const ch = await prisma.challenge.findUnique({ where: { id: idSchema.parse(challengeId) }, select: { slug: true, title: true } });
    if (!ch) throw new UserFacingError("Challenge topilmadi");
    const payload = {
      title: data.title,
      description: nullable(data.description),
      eligibility: data.eligibility,
      rankFrom: data.rankFrom,
      rankTo: data.rankTo ?? data.rankFrom,
      order: data.order,
      isPublished: data.isPublished,
    };
    const saved = rewardId
      ? await prisma.reward.update({ where: { id: idSchema.parse(rewardId), challengeId }, data: payload })
      : await prisma.reward.create({ data: { ...payload, challengeId } });
    await audit({ actorId: admin.id, action: rewardId ? "reward.update" : "reward.create", targetType: "Reward", targetId: saved.id, summary: `${ch.title}: ${data.title}${data.isPublished ? " (e’lon qilingan)" : ""}` });
    revalidateChallenges(ch.slug);
    return { ok: true, message: "Mukofot saqlandi" };
  } catch (err) {
    return actionError(err);
  }
}

export async function deleteReward(rewardId: string): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const r = await prisma.reward.delete({ where: { id: idSchema.parse(rewardId) }, select: { title: true, challenge: { select: { slug: true } } } });
    await audit({ actorId: admin.id, action: "reward.delete", targetType: "Reward", targetId: rewardId, summary: r.title });
    revalidateChallenges(r.challenge?.slug);
    return { ok: true, message: "Mukofot o‘chirildi" };
  } catch (err) {
    return actionError(err);
  }
}

export async function reviewSubmission(submissionId: string, input: z.input<typeof reviewSchema>): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const data = reviewSchema.parse(input);
    const sub = await prisma.challengeSubmission.findUnique({
      where: { id: idSchema.parse(submissionId) },
      select: { challenge: { select: { maxScore: true, status: true, slug: true, title: true } }, user: { select: { email: true } } },
    });
    if (!sub) throw new UserFacingError("Topshiriq topilmadi");
    if (sub.challenge.status === "RESULTS_PUBLISHED") throw new UserFacingError("Natijalar e’lon qilingan — baholarni o‘zgartirib bo‘lmaydi");
    if (data.status === "REVIEWED" && data.score == null) throw new UserFacingError("Ballni kiriting");
    if (data.score != null && data.score > sub.challenge.maxScore) throw new UserFacingError(`Ball ${sub.challenge.maxScore} dan oshmasin`);
    await prisma.challengeSubmission.update({
      where: { id: submissionId },
      data: {
        status: data.status,
        score: data.status === "REVIEWED" ? data.score : null,
        feedback: nullable(data.feedback),
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });
    await audit({
      actorId: admin.id,
      action: "submission.review",
      targetType: "ChallengeSubmission",
      targetId: submissionId,
      summary: `${sub.challenge.title} · ${sub.user.email}: ${data.status}${data.score != null ? ` (${data.score})` : ""}`,
    });
    revalidateChallenges(sub.challenge.slug);
    return { ok: true, message: "Baho saqlandi" };
  } catch (err) {
    return actionError(err);
  }
}

/**
 * Ranks reviewed submissions (score desc, earlier submission first; ties share a rank),
 * attaches published rewards by rank range and publishes results.
 */
export async function publishResults(challengeId: string): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const ch = await prisma.challenge.findUnique({
      where: { id: idSchema.parse(challengeId) },
      select: { id: true, slug: true, title: true, status: true, endsAt: true, passingScore: true },
    });
    if (!ch) throw new UserFacingError("Challenge topilmadi");
    if (ch.status === "DRAFT") throw new UserFacingError("Qoralama challenge natijasini e’lon qilib bo‘lmaydi");
    if (ch.status === "RESULTS_PUBLISHED") throw new UserFacingError("Natijalar allaqachon e’lon qilingan");
    const pending = await prisma.challengeSubmission.count({ where: { challengeId, status: "PENDING" } });
    if (pending > 0) throw new UserFacingError(`${pending} ta topshiriq hali baholanmagan`);

    const [subs, rewards] = await Promise.all([
      prisma.challengeSubmission.findMany({
        where: { challengeId, status: "REVIEWED", score: { not: null } },
        orderBy: [{ score: "desc" }, { submittedAt: "asc" }],
        select: { id: true, userId: true, score: true },
      }),
      prisma.reward.findMany({ where: { challengeId, isPublished: true, rankFrom: { not: null } }, select: { id: true, rankFrom: true, rankTo: true } }),
    ]);

    let prevScore: number | null = null;
    let prevRank = 0;
    const results = subs.map((s, i) => {
      const rank = s.score === prevScore ? prevRank : i + 1;
      prevScore = s.score;
      prevRank = rank;
      const reward = rewards.find((r) => rank >= r.rankFrom! && rank <= (r.rankTo ?? r.rankFrom!));
      const outcome = reward ? "WINNER" : ch.passingScore != null && s.score! >= ch.passingScore ? "PASSED" : "PARTICIPANT";
      return { challengeId, userId: s.userId, submissionId: s.id, score: s.score!, rank, outcome: outcome as "WINNER" | "PASSED" | "PARTICIPANT", rewardId: reward?.id ?? null };
    });

    const now = new Date();
    await prisma.$transaction([
      prisma.challengeResult.deleteMany({ where: { challengeId } }),
      prisma.challengeResult.createMany({ data: results.map((r) => ({ ...r, publishedAt: now })) }),
      prisma.challenge.update({ where: { id: challengeId }, data: { status: "RESULTS_PUBLISHED", resultsPublishedAt: now } }),
    ]);
    for (const r of results) {
      if (r.outcome === "WINNER") await awardAchievement(r.userId, "CHALLENGE_WINNER", challengeId);
      if (r.outcome !== "PARTICIPANT") await awardAchievement(r.userId, "CHALLENGE_PASSED", challengeId);
    }
    await audit({ actorId: admin.id, action: "challenge.results.publish", targetType: "Challenge", targetId: challengeId, summary: `${ch.title}: ${results.length} ta natija` });
    revalidateChallenges(ch.slug);
    return { ok: true, message: `Natijalar e’lon qilindi (${results.length} ta ishtirokchi)` };
  } catch (err) {
    return actionError(err);
  }
}
