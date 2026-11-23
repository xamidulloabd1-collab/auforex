/**
 * Sequential lessons: inside a course a lesson opens once every earlier lesson is completed.
 * Completed lessons always stay open (for rewatching), even if an earlier one was added later.
 */
export type SequenceItem = { id: string; completed: boolean };

/** `lessons` must be one course's published lessons in display order. */
export function lockedLessonIds(lessons: readonly SequenceItem[], enabled = true): Set<string> {
  if (!enabled) return new Set();
  const firstOpen = lessons.findIndex((l) => !l.completed);
  if (firstOpen === -1) return new Set();
  return new Set(lessons.filter((l, i) => i > firstOpen && !l.completed).map((l) => l.id));
}

/** The lesson the viewer has to finish before `lessonId` opens (null = it is open). */
export function blockingLesson<T extends SequenceItem>(lessons: readonly T[], lessonId: string, enabled = true): T | null {
  if (!lockedLessonIds(lessons, enabled).has(lessonId)) return null;
  return lessons.find((l) => !l.completed) ?? null;
}
