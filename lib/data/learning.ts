import "server-only";
import { prisma } from "@/lib/db/prisma";
import { publicMediaUrl } from "@/lib/storage/keys";

/** Published lessons are ordered by course order, then lesson order. */
const publishedLessonWhere = { isPublished: true, course: { isPublished: true } } as const;
const lessonOrder = [{ course: { order: "asc" as const } }, { course: { createdAt: "asc" as const } }, { order: "asc" as const }, { createdAt: "asc" as const }];

export async function getPublicCounts() {
  const now = new Date();
  const [lessons, books, challenges, duration] = await Promise.all([
    prisma.lesson.count({ where: publishedLessonWhere }),
    prisma.book.count({ where: { isPublished: true } }),
    prisma.challenge.count({ where: { status: "PUBLISHED", endsAt: { gte: now } } }),
    prisma.lesson.aggregate({ where: publishedLessonWhere, _sum: { durationSeconds: true } }),
  ]);
  return { lessons, books, challenges, totalDurationSeconds: duration._sum.durationSeconds ?? 0 };
}

export type LessonCard = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  courseTitle: string;
  courseSlug: string;
  categoryName: string | null;
  categorySlug: string | null;
  progressPercent: number;
  completed: boolean;
  lastViewedAt: Date | null;
};

/** Metadata-only preview (no media) — safe to show to anyone on the homepage. */
export async function getLessonPreviews(limit = 6) {
  const lessons = await prisma.lesson.findMany({
    where: publishedLessonWhere,
    orderBy: lessonOrder,
    take: limit,
    select: {
      id: true,
      title: true,
      durationSeconds: true,
      thumbnailKey: true,
      course: { select: { title: true, category: { select: { name: true } } } },
    },
  });
  return lessons.map((l) => ({
    id: l.id,
    title: l.title,
    durationSeconds: l.durationSeconds,
    thumbnailUrl: publicMediaUrl(l.thumbnailKey),
    courseTitle: l.course.title,
    categoryName: l.course.category?.name ?? null,
  }));
}

export async function getBookPreviews(limit = 3) {
  const books = await prisma.book.findMany({
    where: { isPublished: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: { id: true, title: true, author: true, pageCount: true, coverKey: true, category: { select: { name: true } } },
  });
  return books.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    pageCount: b.pageCount,
    coverUrl: publicMediaUrl(b.coverKey),
    categoryName: b.category?.name ?? null,
  }));
}

/** Full catalogue for PRO users (still metadata only — media goes through protected routes). */
export async function getLessonCatalog(userId: string) {
  const [courses, progress] = await Promise.all([
    prisma.course.findMany({
      where: { isPublished: true, lessons: { some: { isPublished: true } } },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        category: { select: { name: true, slug: true } },
        lessons: {
          where: { isPublished: true },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: { id: true, slug: true, title: true, description: true, durationSeconds: true, thumbnailKey: true },
        },
      },
    }),
    prisma.lessonProgress.findMany({
      where: { userId },
      select: { lessonId: true, percent: true, completedAt: true, lastViewedAt: true },
    }),
  ]);

  const byLesson = new Map(progress.map((p) => [p.lessonId, p]));
  const lessons: LessonCard[] = courses.flatMap((c) =>
    c.lessons.map((l) => {
      const p = byLesson.get(l.id);
      return {
        id: l.id,
        slug: l.slug,
        title: l.title,
        description: l.description,
        durationSeconds: l.durationSeconds,
        thumbnailUrl: publicMediaUrl(l.thumbnailKey),
        courseTitle: c.title,
        courseSlug: c.slug,
        categoryName: c.category?.name ?? null,
        categorySlug: c.category?.slug ?? null,
        progressPercent: p?.completedAt ? 100 : (p?.percent ?? 0),
        completed: Boolean(p?.completedAt),
        lastViewedAt: p?.lastViewedAt ?? null,
      };
    }),
  );

  const completed = lessons.filter((l) => l.completed).length;
  const continueWatching = lessons
    .filter((l) => !l.completed && l.lastViewedAt && l.progressPercent > 0)
    .sort((a, b) => (b.lastViewedAt?.getTime() ?? 0) - (a.lastViewedAt?.getTime() ?? 0))
    .slice(0, 3);

  const categories = Array.from(
    new Map(
      courses.filter((c) => c.category).map((c) => [c.category!.slug, { slug: c.category!.slug, name: c.category!.name }]),
    ).values(),
  );

  return {
    courses: courses.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      description: c.description,
      categoryName: c.category?.name ?? null,
      categorySlug: c.category?.slug ?? null,
      lessonIds: c.lessons.map((l) => l.id),
    })),
    lessons,
    categories,
    stats: {
      total: lessons.length,
      completed,
      percent: lessons.length ? Math.round((completed / lessons.length) * 100) : 0,
    },
    continueWatching,
  };
}

export async function getLessonForViewer(slug: string, opts: { userId: string; isAdmin: boolean }) {
  const lesson = await prisma.lesson.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      durationSeconds: true,
      videoSource: true,
      videoKey: true,
      embedUrl: true,
      thumbnailKey: true,
      isPublished: true,
      course: { select: { id: true, title: true, slug: true, isPublished: true, category: { select: { name: true } } } },
    },
  });
  if (!lesson) return null;
  const visible = lesson.isPublished && lesson.course.isPublished;
  if (!visible && !opts.isAdmin) return null;

  const ordered = await prisma.lesson.findMany({
    where: opts.isAdmin && !visible ? { courseId: lesson.course.id } : publishedLessonWhere,
    orderBy: lessonOrder,
    select: { id: true, slug: true, title: true, durationSeconds: true, courseId: true },
  });
  const index = ordered.findIndex((l) => l.id === lesson.id);
  const progress = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId: opts.userId, lessonId: lesson.id } },
    select: { positionSeconds: true, percent: true, completedAt: true },
  });
  const courseLessons = ordered.filter((l) => l.courseId === lesson.course.id);
  const courseProgress = await prisma.lessonProgress.findMany({
    where: { userId: opts.userId, lessonId: { in: courseLessons.map((l) => l.id) } },
    select: { lessonId: true, completedAt: true, percent: true },
  });
  const cp = new Map(courseProgress.map((p) => [p.lessonId, p]));

  return {
    lesson: {
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      description: lesson.description,
      durationSeconds: lesson.durationSeconds,
      videoSource: lesson.videoSource,
      hasVideo: lesson.videoSource === "UPLOAD" ? Boolean(lesson.videoKey) : Boolean(lesson.embedUrl),
      embedUrl: lesson.videoSource === "EMBED" ? lesson.embedUrl : null,
      posterUrl: publicMediaUrl(lesson.thumbnailKey),
      isPublished: visible,
      course: { title: lesson.course.title, slug: lesson.course.slug, categoryName: lesson.course.category?.name ?? null },
    },
    progress: progress
      ? { positionSeconds: progress.positionSeconds, percent: progress.percent, completed: Boolean(progress.completedAt) }
      : null,
    prev: index > 0 ? ordered[index - 1]! : null,
    next: index >= 0 && index < ordered.length - 1 ? ordered[index + 1]! : null,
    position: index + 1,
    total: ordered.length,
    courseLessons: courseLessons.map((l) => ({
      ...l,
      completed: Boolean(cp.get(l.id)?.completedAt),
      percent: cp.get(l.id)?.percent ?? 0,
    })),
  };
}

export type BookCard = {
  id: string;
  slug: string;
  title: string;
  author: string | null;
  description: string | null;
  pageCount: number | null;
  coverUrl: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  currentPage: number;
  percent: number;
  completed: boolean;
  lastOpenedAt: Date | null;
};

export async function getBookCatalog(userId: string) {
  const [books, progress] = await Promise.all([
    prisma.book.findMany({
      where: { isPublished: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        author: true,
        description: true,
        pageCount: true,
        coverKey: true,
        category: { select: { name: true, slug: true } },
      },
    }),
    prisma.readingProgress.findMany({
      where: { userId },
      select: { bookId: true, currentPage: true, percent: true, completedAt: true, lastOpenedAt: true },
    }),
  ]);
  const byBook = new Map(progress.map((p) => [p.bookId, p]));
  const items: BookCard[] = books.map((b) => {
    const p = byBook.get(b.id);
    return {
      id: b.id,
      slug: b.slug,
      title: b.title,
      author: b.author,
      description: b.description,
      pageCount: b.pageCount,
      coverUrl: publicMediaUrl(b.coverKey),
      categoryName: b.category?.name ?? null,
      categorySlug: b.category?.slug ?? null,
      currentPage: p?.currentPage ?? 1,
      percent: p?.completedAt ? 100 : (p?.percent ?? 0),
      completed: Boolean(p?.completedAt),
      lastOpenedAt: p?.lastOpenedAt ?? null,
    };
  });
  const categories = Array.from(
    new Map(items.filter((b) => b.categorySlug).map((b) => [b.categorySlug!, { slug: b.categorySlug!, name: b.categoryName! }])).values(),
  );
  const continueReading = items
    .filter((b) => b.lastOpenedAt && !b.completed)
    .sort((a, b) => (b.lastOpenedAt?.getTime() ?? 0) - (a.lastOpenedAt?.getTime() ?? 0))
    .slice(0, 3);
  return { books: items, categories, continueReading };
}

export async function getBookForViewer(slug: string, opts: { userId: string; isAdmin: boolean }) {
  const book = await prisma.book.findUnique({
    where: { slug },
    select: { id: true, slug: true, title: true, author: true, pageCount: true, isPublished: true },
  });
  if (!book || (!book.isPublished && !opts.isAdmin)) return null;
  const progress = await prisma.readingProgress.findUnique({
    where: { userId_bookId: { userId: opts.userId, bookId: book.id } },
    select: { currentPage: true, percent: true },
  });
  return { book, progress };
}
