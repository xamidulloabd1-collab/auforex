import "server-only";
import { prisma } from "@/lib/db/prisma";
import { publicDisplayName } from "@/lib/utils";

export type ChallengePhase = "UPCOMING" | "OPEN" | "ENDED" | "RESULTS";

export function challengePhase(c: { status: string; startsAt: Date; endsAt: Date }, now = new Date()): ChallengePhase {
  if (c.status === "RESULTS_PUBLISHED") return "RESULTS";
  if (c.status === "CLOSED") return "ENDED";
  if (now < c.startsAt) return "UPCOMING";
  if (now > c.endsAt) return "ENDED";
  return "OPEN";
}

export const PHASE_LABELS: Record<ChallengePhase, string> = {
  UPCOMING: "Tez orada",
  OPEN: "Qabul ochiq",
  ENDED: "Yakunlangan",
  RESULTS: "Natijalar e’lon qilingan",
};

const VISIBLE_STATUSES = ["PUBLISHED", "CLOSED", "RESULTS_PUBLISHED"] as const;

export async function listChallenges(viewerId: string | null) {
  const challenges = await prisma.challenge.findMany({
    where: { status: { in: [...VISIBLE_STATUSES] } },
    orderBy: [{ startsAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      type: true,
      status: true,
      startsAt: true,
      endsAt: true,
      maxScore: true,
      _count: { select: { submissions: true, questions: true } },
      rewards: { where: { isPublished: true }, select: { id: true } },
      submissions: viewerId
        ? { where: { userId: viewerId }, select: { status: true, score: true, autoScore: true } }
        : false,
      results: viewerId ? { where: { userId: viewerId }, select: { rank: true, outcome: true, score: true } } : false,
    },
  });
  return challenges.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    summary: c.summary,
    type: c.type,
    phase: challengePhase(c),
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    maxScore: c.maxScore,
    participants: c._count.submissions,
    hasRewards: c.rewards.length > 0,
    mySubmission: (c.submissions || [])[0] ?? null,
    myResult: (c.results || [])[0] ?? null,
  }));
}

export async function getChallengeDetail(slug: string, opts: { viewerId: string | null; isAdmin: boolean; canParticipate: boolean }) {
  const challenge = await prisma.challenge.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      description: true,
      type: true,
      status: true,
      objectives: true,
      requirements: true,
      startsAt: true,
      endsAt: true,
      maxScore: true,
      passingScore: true,
      allowAttachment: true,
      showLeaderboard: true,
      resultsPublishedAt: true,
      _count: { select: { submissions: true } },
    },
  });
  if (!challenge) return null;
  if (challenge.status === "DRAFT" && !opts.isAdmin) return null;

  const phase = challengePhase(challenge);

  const [rewards, questions, submission, myResult, leaderboard] = await Promise.all([
    prisma.reward.findMany({
      where: { challengeId: challenge.id, isPublished: true },
      orderBy: [{ order: "asc" }, { rankFrom: "asc" }],
      select: { id: true, title: true, description: true, eligibility: true, rankFrom: true, rankTo: true },
    }),
    // Questions (without answers) only for participants who may take part.
    challenge.type === "QUIZ" && opts.canParticipate
      ? prisma.challengeQuestion.findMany({
          where: { challengeId: challenge.id },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: { id: true, prompt: true, options: true, points: true },
        })
      : Promise.resolve([]),
    opts.viewerId
      ? prisma.challengeSubmission.findUnique({
          where: { challengeId_userId: { challengeId: challenge.id, userId: opts.viewerId } },
          select: {
            id: true,
            content: true,
            linkUrl: true,
            attachmentKey: true,
            answers: true,
            autoScore: true,
            status: true,
            score: true,
            feedback: true,
            submittedAt: true,
            updatedAt: true,
          },
        })
      : Promise.resolve(null),
    opts.viewerId && phase === "RESULTS"
      ? prisma.challengeResult.findUnique({
          where: { challengeId_userId: { challengeId: challenge.id, userId: opts.viewerId } },
          select: { rank: true, score: true, outcome: true, reward: { select: { title: true } } },
        })
      : Promise.resolve(null),
    phase === "RESULTS" && challenge.showLeaderboard
      ? prisma.challengeResult.findMany({
          where: { challengeId: challenge.id },
          orderBy: [{ rank: "asc" }],
          take: 20,
          select: { rank: true, score: true, outcome: true, userId: true, user: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  return {
    challenge: { ...challenge, participants: challenge._count.submissions },
    phase,
    rewards,
    questions,
    submission: submission
      ? { ...submission, hasAttachment: Boolean(submission.attachmentKey), attachmentKey: undefined }
      : null,
    myResult,
    leaderboard: leaderboard.map((r) => ({
      rank: r.rank,
      score: r.score,
      outcome: r.outcome,
      name: publicDisplayName(r.user.name),
      isMe: r.userId === opts.viewerId,
    })),
  };
}
