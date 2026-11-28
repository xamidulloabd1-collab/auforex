import "server-only";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { blockingLesson, lockedLessonIds } from "@/lib/lessons/sequence";
import { getSetting } from "@/lib/settings";
import { publicMediaUrl } from "@/lib/storage/keys";
import { signBunnyEmbed } from "@/lib/video/bunny";

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
  /** Lesson number inside its course ("5-dars"). */
  number: number;
  isFree: boolean;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
  /** Why the viewer cannot open it yet: "pro" = needs PRO, "sequence" = finish the previous lesson. */
  lockReason: "pro" | "sequence" | null;
  locked: boolean;
  lastViewedAt: Date | null;
};

/** Lesson topic: its own category, else the course's. */
function lessonCategory(l: { category: { name: string; slug: string; order: number } | null }, c: { category: { name: string; slug: string; order: number } | null }) {
  return l.category ?? c.category ?? null;
}

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

/**
 * Catalogue for every viewer (metadata only — media goes through protected routes).
 * PRO lessons are listed for FREE users and guests too, marked as locked with the reason.
 */
export async function getLessonCatalog(userId: string | null, opts: { isAdmin?: boolean; hasPremium?: boolean } = {}) {
  const sequential = !opts.isAdmin && (await getSetting("access")).sequentialLessons;
  const premium = Boolean(opts.isAdmin || opts.hasPremium);
  const [courses, progress] = await Promise.all([
    prisma.course.findMany({
      where: { isPublished: true, lessons: { some: { isPublished: true } } },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        category: { select: { name: true, slug: true, order: true } },
        lessons: {
          where: { isPublished: true },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            durationSeconds: true,
            thumbnailKey: true,
            order: true,
            isFree: true,
            level: true,
            category: { select: { name: true, slug: true, order: true } },
          },
        },
      },
    }),
    userId
      ? prisma.lessonProgress.findMany({
          where: { userId },
          select: { lessonId: true, percent: true, completedAt: true, lastViewedAt: true },
        })
      : Promise.resolve([]),
  ]);

  const byLesson = new Map(progress.map((p) => [p.lessonId, p]));
  const lessons: LessonCard[] = courses.flatMap((c) => {
    // The order rule runs over the lessons this viewer can open (FREE users: the free ones).
    const locked = lockedLessonIds(
      c.lessons.filter((l) => premium || l.isFree).map((l) => ({ id: l.id, completed: Boolean(byLesson.get(l.id)?.completedAt) })),
      sequential,
    );
    return c.lessons.map((l) => {
      const p = byLesson.get(l.id);
      const cat = lessonCategory(l, c);
      const lockReason = !premium && !l.isFree ? ("pro" as const) : locked.has(l.id) ? ("sequence" as const) : null;
      return {
        id: l.id,
        slug: l.slug,
        title: l.title,
        description: l.description,
        durationSeconds: l.durationSeconds,
        thumbnailUrl: publicMediaUrl(l.thumbnailKey),
        courseTitle: c.title,
        courseSlug: c.slug,
        categoryName: cat?.name ?? null,
        categorySlug: cat?.slug ?? null,
        progressPercent: p?.completedAt ? 100 : (p?.percent ?? 0),
        completed: Boolean(p?.completedAt),
        number: l.order,
        isFree: l.isFree,
        level: l.level,
        lockReason,
        locked: lockReason !== null,
        lastViewedAt: p?.lastViewedAt ?? null,
      };
    });
  });

  // Progress counts the lessons this viewer can open (all of them for PRO, the free ones otherwise).
  const reachable = lessons.filter((l) => l.lockReason !== "pro");
  const completed = reachable.filter((l) => l.completed).length;
  const continueWatching = lessons
    .filter((l) => !l.completed && !l.locked && l.lastViewedAt && l.progressPercent > 0)
    .sort((a, b) => (b.lastViewedAt?.getTime() ?? 0) - (a.lastViewedAt?.getTime() ?? 0))
    .slice(0, 3);

  const categoryOrder = new Map<string, { slug: string; name: string; order: number }>();
  for (const c of courses) {
    for (const l of c.lessons) {
      const cat = lessonCategory(l, c);
      if (cat) categoryOrder.set(cat.slug, { slug: cat.slug, name: cat.name, order: cat.order });
    }
  }
  const categories = [...categoryOrder.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)).map(({ slug, name }) => ({ slug, name }));

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
      total: reachable.length,
      all: lessons.length,
      proLocked: lessons.length - reachable.length,
      completed,
      percent: reachable.length ? Math.round((completed / reachable.length) * 100) : 0,
    },
    continueWatching,
  };
}

export async function getLessonForViewer(slug: string, opts: { userId: string; isAdmin: boolean; hasPremium: boolean }) {
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
      order: true,
      isFree: true,
      level: true,
      category: { select: { name: true } },
      course: { select: { id: true, title: true, slug: true, isPublished: true, category: { select: { name: true } } } },
    },
  });
  if (!lesson) return null;
  const visible = lesson.isPublished && lesson.course.isPublished;
  if (!visible && !opts.isAdmin) return null;

  // Independent reads run together (one round trip instead of four on a slow serverless connection).
  const [ordered, progress, courseProgress, access] = await Promise.all([
    prisma.lesson.findMany({
      where: opts.isAdmin && !visible ? { courseId: lesson.course.id } : publishedLessonWhere,
      orderBy: lessonOrder,
      select: { id: true, slug: true, title: true, durationSeconds: true, courseId: true, order: true, isFree: true },
    }),
    prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: opts.userId, lessonId: lesson.id } },
      select: { positionSeconds: true, percent: true, completedAt: true },
    }),
    prisma.lessonProgress.findMany({
      where: { userId: opts.userId, lesson: { courseId: lesson.course.id } },
      select: { lessonId: true, completedAt: true, percent: true },
    }),
    opts.isAdmin ? null : getSetting("access"),
  ]);
  const index = ordered.findIndex((l) => l.id === lesson.id);
  // PRO lessons need PRO (or admin); free lessons are open to every signed-in user.
  const canWatch = opts.isAdmin || opts.hasPremium || lesson.isFree;
  const courseLessons = ordered.filter((l) => l.courseId === lesson.course.id);
  const cp = new Map(courseProgress.map((p) => [p.lessonId, p]));

  // Sequential mode (Super admin → Sozlamalar → Kirish): admins are never locked out.
  const sequential = Boolean(access?.sequentialLessons);
  const sequence = courseLessons
    .filter((l) => opts.isAdmin || opts.hasPremium || l.isFree)
    .map((l) => ({ ...l, completed: Boolean(cp.get(l.id)?.completedAt) }));
  const locked = lockedLessonIds(sequence, sequential);
  const blocker = blockingLesson(sequence, lesson.id, sequential);
  const embedUrl =
    canWatch && lesson.videoSource === "EMBED" && lesson.embedUrl && !blocker ? signBunnyEmbed(lesson.embedUrl, env().BUNNY_STREAM_TOKEN_KEY) : null;
  const premium = opts.isAdmin || opts.hasPremium;
  const nextLesson = index >= 0 && index < ordered.length - 1 ? ordered[index + 1]! : null;

  return {
    lesson: {
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      description: lesson.description,
      durationSeconds: lesson.durationSeconds,
      videoSource: lesson.videoSource,
      hasVideo: lesson.videoSource === "UPLOAD" ? Boolean(lesson.videoKey) : Boolean(lesson.embedUrl),
      embedUrl,
      posterUrl: publicMediaUrl(lesson.thumbnailKey),
      isPublished: visible,
      number: lesson.order,
      isFree: lesson.isFree,
      level: lesson.level,
      categoryName: lesson.category?.name ?? lesson.course.category?.name ?? null,
      course: { title: lesson.course.title, slug: lesson.course.slug, categoryName: lesson.course.category?.name ?? null },
    },
    /** False: a PRO lesson for a viewer without PRO — the page shows the subscription offer instead. */
    canWatch,
    progress: progress
      ? { positionSeconds: progress.positionSeconds, percent: progress.percent, completed: Boolean(progress.completedAt) }
      : null,
    prev: index > 0 ? ordered[index - 1]! : null,
    next: nextLesson ? { ...nextLesson, locked: locked.has(nextLesson.id) || (!premium && !nextLesson.isFree) } : null,
    /** Set when this lesson is still locked: the lesson to finish first. */
    blocker: blocker ? { slug: blocker.slug, title: blocker.title } : null,
    position: index + 1,
    total: ordered.length,
    courseLessons: courseLessons.map((l) => ({
      ...l,
      completed: Boolean(cp.get(l.id)?.completedAt),
      percent: cp.get(l.id)?.percent ?? 0,
      locked: locked.has(l.id) || (!premium && !l.isFree),
      proOnly: !premium && !l.isFree,
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

/**
 * For API routes: the lesson a viewer must finish before `lessonId` opens, or null when it is
 * open (sequential mode off, admin, or every earlier lesson in the course completed).
 */
export async function getLessonBlocker(lessonId: string, viewer: { id: string; isAdmin: boolean; hasPremium: boolean }) {
  if (viewer.isAdmin || !(await getSetting("access")).sequentialLessons) return null;
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { courseId: true } });
  if (!lesson) return null;
  const lessons = await prisma.lesson.findMany({
    where: { courseId: lesson.courseId, isPublished: true, ...(viewer.hasPremium ? {} : { isFree: true }) },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, slug: true, title: true },
  });
  const done = await prisma.lessonProgress.findMany({
    where: { userId: viewer.id, lessonId: { in: lessons.map((l) => l.id) }, completedAt: { not: null } },
    select: { lessonId: true },
  });
  const completed = new Set(done.map((d) => d.lessonId));
  return blockingLesson(lessons.map((l) => ({ ...l, completed: completed.has(l.id) })), lessonId);
}
