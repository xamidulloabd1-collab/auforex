import "server-only";
import { prisma } from "@/lib/db/prisma";
import { publicMediaUrl } from "@/lib/storage/keys";
import { challengePhase } from "./challenges";

export async function getDashboardOverview(userId: string) {
  const [profile, totalLessons, completedLessons, recentLessons, recentBooks, achievements, submissions] = await Promise.all([
    prisma.profile.findUnique({ where: { userId }, select: { bio: true, telegram: true, experienceLevel: true } }),
    prisma.lesson.count({ where: { isPublished: true, course: { isPublished: true } } }),
    prisma.lessonProgress.count({ where: { userId, completedAt: { not: null }, lesson: { isPublished: true, course: { isPublished: true } } } }),
    prisma.lessonProgress.findMany({
      where: { userId, lesson: { isPublished: true, course: { isPublished: true } } },
      orderBy: { lastViewedAt: "desc" },
      take: 4,
      select: { percent: true, completedAt: true, lastViewedAt: true, lesson: { select: { slug: true, title: true, course: { select: { title: true } } } } },
    }),
    prisma.readingProgress.findMany({
      where: { userId, book: { isPublished: true } },
      orderBy: { lastOpenedAt: "desc" },
      take: 3,
      select: { percent: true, currentPage: true, totalPages: true, lastOpenedAt: true, book: { select: { slug: true, title: true, coverKey: true, author: true } } },
    }),
    prisma.userAchievement.count({ where: { userId } }),
    prisma.challengeSubmission.count({ where: { userId } }),
  ]);
  return {
    profile,
    learning: {
      total: totalLessons,
      completed: completedLessons,
      percent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
    },
    recentLessons: recentLessons.map((r) => ({
      slug: r.lesson.slug,
      title: r.lesson.title,
      courseTitle: r.lesson.course.title,
      percent: r.completedAt ? 100 : r.percent,
      completed: Boolean(r.completedAt),
      lastViewedAt: r.lastViewedAt,
    })),
    recentBooks: recentBooks.map((r) => ({
      slug: r.book.slug,
      title: r.book.title,
      author: r.book.author,
      coverUrl: publicMediaUrl(r.book.coverKey),
      percent: r.percent,
      currentPage: r.currentPage,
      totalPages: r.totalPages,
      lastOpenedAt: r.lastOpenedAt,
    })),
    achievements,
    submissions,
  };
}

export async function getMyLearning(userId: string) {
  const progress = await prisma.lessonProgress.findMany({
    where: { userId, lesson: { isPublished: true, course: { isPublished: true } } },
    orderBy: { lastViewedAt: "desc" },
    select: {
      percent: true,
      completedAt: true,
      lastViewedAt: true,
      lesson: { select: { id: true, slug: true, title: true, durationSeconds: true, course: { select: { id: true } } } },
    },
  });
  const startedCourseIds = Array.from(new Set(progress.map((p) => p.lesson.course.id)));
  const courses = await prisma.course.findMany({
    where: { id: { in: startedCourseIds }, isPublished: true },
    select: {
      id: true,
      title: true,
      slug: true,
      category: { select: { name: true } },
      lessons: { where: { isPublished: true }, orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, slug: true } },
    },
  });
  const completedSet = new Set(progress.filter((p) => p.completedAt).map((p) => p.lesson.id));
  return {
    courses: courses.map((c) => {
      const done = c.lessons.filter((l) => completedSet.has(l.id)).length;
      const nextLesson = c.lessons.find((l) => !completedSet.has(l.id));
      return {
        id: c.id,
        title: c.title,
        categoryName: c.category?.name ?? null,
        total: c.lessons.length,
        completed: done,
        percent: c.lessons.length ? Math.round((done / c.lessons.length) * 100) : 0,
        nextSlug: nextLesson?.slug ?? c.lessons[0]?.slug ?? null,
      };
    }),
    continueWatching: progress
      .filter((p) => !p.completedAt && p.percent > 0)
      .slice(0, 6)
      .map((p) => ({ slug: p.lesson.slug, title: p.lesson.title, percent: p.percent, lastViewedAt: p.lastViewedAt })),
    completed: progress
      .filter((p) => p.completedAt)
      .map((p) => ({ slug: p.lesson.slug, title: p.lesson.title, completedAt: p.completedAt!, durationSeconds: p.lesson.durationSeconds })),
  };
}

export async function getMyChallenges(userId: string) {
  const now = new Date();
  const [available, submissions, achievements] = await Promise.all([
    prisma.challenge.findMany({
      where: { status: "PUBLISHED", startsAt: { lte: now }, endsAt: { gte: now }, submissions: { none: { userId } } },
      orderBy: { endsAt: "asc" },
      select: { id: true, slug: true, title: true, type: true, endsAt: true },
    }),
    prisma.challengeSubmission.findMany({
      where: { userId },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        status: true,
        score: true,
        submittedAt: true,
        result: { select: { rank: true, outcome: true } },
        challenge: { select: { slug: true, title: true, type: true, status: true, startsAt: true, endsAt: true, maxScore: true } },
      },
    }),
    prisma.userAchievement.findMany({
      where: { userId },
      orderBy: { awardedAt: "desc" },
      select: { awardedAt: true, achievement: { select: { code: true, title: true, description: true, icon: true } } },
    }),
  ]);
  const allAchievements = await prisma.achievement.findMany({ orderBy: { createdAt: "asc" }, select: { code: true, title: true, description: true, icon: true } });
  return {
    available,
    participated: submissions.filter((s) => challengePhase(s.challenge, now) !== "RESULTS"),
    completed: submissions.filter((s) => challengePhase(s.challenge, now) === "RESULTS"),
    earned: achievements,
    allAchievements,
  };
}
