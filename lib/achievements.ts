import "server-only";
import { prisma } from "@/lib/db/prisma";

export type AchievementCode =
  | "FIRST_LESSON"
  | "TEN_LESSONS"
  | "FIRST_BOOK"
  | "FIRST_CHALLENGE"
  | "PERFECT_QUIZ"
  | "CHALLENGE_PASSED"
  | "CHALLENGE_WINNER";

/** Awards a badge once per user. Silently ignores unknown codes and duplicates. */
export async function awardAchievement(userId: string, code: AchievementCode, challengeId?: string) {
  try {
    const achievement = await prisma.achievement.findUnique({ where: { code }, select: { id: true } });
    if (!achievement) return;
    await prisma.userAchievement.upsert({
      where: { userId_achievementId: { userId, achievementId: achievement.id } },
      update: {},
      create: { userId, achievementId: achievement.id, challengeId: challengeId ?? null },
    });
  } catch (err) {
    console.error("[achievements] award failed", code, err);
  }
}

export async function checkLessonAchievements(userId: string) {
  const completed = await prisma.lessonProgress.count({ where: { userId, completedAt: { not: null } } });
  if (completed >= 1) await awardAchievement(userId, "FIRST_LESSON");
  if (completed >= 10) await awardAchievement(userId, "TEN_LESSONS");
}
