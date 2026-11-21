import { NextResponse } from "next/server";
import { assertSameOrigin, handleRouteError, jsonError } from "@/lib/api";
import { assertUser } from "@/lib/auth/session";
import { awardAchievement } from "@/lib/achievements";
import { prisma } from "@/lib/db/prisma";
import { challengePhase } from "@/lib/data/challenges";
import { rateLimit } from "@/lib/rate-limit";
import { deleteStoredFile, storeUpload, UploadError } from "@/lib/storage";
import { quizAnswersSchema, submissionTextSchema } from "@/lib/validations/challenge";

/**
 * Creates or updates the viewer's submission for a challenge.
 * Rules: PRO (or admin) only · challenge must be open · a reviewed submission is final.
 * Accepts multipart/form-data: content, linkUrl, answers (JSON), attachment (image).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/challenges/[id]/submission">) {
  let storedKey: string | null = null;
  try {
    assertSameOrigin(request);
    const viewer = await assertUser();
    if (!viewer.hasPremium) return jsonError(403, "Challenge’da qatnashish uchun PRO obuna kerak");
    rateLimit(`submission:${viewer.id}`, 10, 60_000);

    const { id } = await ctx.params;
    const challenge = await prisma.challenge.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        status: true,
        startsAt: true,
        endsAt: true,
        maxScore: true,
        allowAttachment: true,
        questions: { select: { id: true, correctIndex: true, points: true, options: true } },
      },
    });
    if (!challenge || challenge.status === "DRAFT") return jsonError(404, "Challenge topilmadi");
    if (challengePhase(challenge) !== "OPEN") return jsonError(409, "Bu challenge hozir topshiriq qabul qilmaydi");

    const existing = await prisma.challengeSubmission.findUnique({
      where: { challengeId_userId: { challengeId: challenge.id, userId: viewer.id } },
      select: { id: true, status: true, reviewedAt: true, attachmentKey: true },
    });
    if (existing && (existing.status !== "PENDING" || existing.reviewedAt)) {
      return jsonError(409, "Topshiriq allaqachon baholangan — uni o‘zgartirib bo‘lmaydi");
    }

    const form = await request.formData();

    if (challenge.type === "QUIZ") {
      if (challenge.questions.length === 0) return jsonError(409, "Bu testda hali savollar yo‘q");
      const answers = quizAnswersSchema.parse(JSON.parse(String(form.get("answers") ?? "{}")));
      const missing = challenge.questions.filter((q) => answers[q.id] === undefined);
      if (missing.length) return jsonError(400, `Barcha savollarga javob bering (${missing.length} ta qoldi)`);
      for (const q of challenge.questions) {
        if (answers[q.id]! >= q.options.length) return jsonError(400, "Javob varianti noto‘g‘ri");
      }
      const totalPoints = challenge.questions.reduce((s, q) => s + q.points, 0);
      const earned = challenge.questions.reduce((s, q) => s + (answers[q.id] === q.correctIndex ? q.points : 0), 0);
      const score = Math.round((earned / totalPoints) * challenge.maxScore);
      const now = new Date();
      // Quizzes are graded automatically; an admin can still adjust the score.
      await prisma.challengeSubmission.upsert({
        where: { challengeId_userId: { challengeId: challenge.id, userId: viewer.id } },
        update: { answers, autoScore: score, score, status: "REVIEWED", reviewedAt: now },
        create: { challengeId: challenge.id, userId: viewer.id, answers, autoScore: score, score, status: "REVIEWED", reviewedAt: now },
      });
      await awardAchievement(viewer.id, "FIRST_CHALLENGE", challenge.id);
      if (score === challenge.maxScore) await awardAchievement(viewer.id, "PERFECT_QUIZ", challenge.id);
      return NextResponse.json({ ok: true, score, maxScore: challenge.maxScore, correct: earned, total: totalPoints });
    }

    const { content, linkUrl } = submissionTextSchema.parse({
      content: String(form.get("content") ?? ""),
      linkUrl: String(form.get("linkUrl") ?? ""),
    });

    const file = form.get("attachment");
    let attachment: { key: string; mime: string } | null = null;
    if (file instanceof File && file.size > 0) {
      if (!challenge.allowAttachment) return jsonError(400, "Bu challenge uchun fayl biriktirish yoqilmagan");
      const stored = await storeUpload("submission", file.stream());
      storedKey = stored.key;
      attachment = { key: stored.key, mime: stored.mime };
    }

    await prisma.challengeSubmission.upsert({
      where: { challengeId_userId: { challengeId: challenge.id, userId: viewer.id } },
      update: {
        content,
        linkUrl: linkUrl || null,
        ...(attachment ? { attachmentKey: attachment.key, attachmentMime: attachment.mime } : {}),
        status: "PENDING",
      },
      create: {
        challengeId: challenge.id,
        userId: viewer.id,
        content,
        linkUrl: linkUrl || null,
        attachmentKey: attachment?.key ?? null,
        attachmentMime: attachment?.mime ?? null,
      },
    });
    storedKey = null;
    if (attachment && existing?.attachmentKey) await deleteStoredFile(existing.attachmentKey);
    await awardAchievement(viewer.id, "FIRST_CHALLENGE", challenge.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (storedKey) await deleteStoredFile(storedKey);
    if (err instanceof SyntaxError) return jsonError(400, "Javoblar formati noto‘g‘ri");
    if (err instanceof UploadError) return jsonError(err.status, err.message);
    return handleRouteError(err);
  }
}
