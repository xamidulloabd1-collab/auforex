import "server-only";
import { prisma } from "@/lib/db/prisma";

/** Courses, lesson categories and each course's next free lesson number — for the lesson form. */
export async function lessonFormOptions() {
  const [courses, categories, maxima] = await Promise.all([
    prisma.course.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, title: true, categoryId: true } }),
    prisma.category.findMany({ where: { kind: "COURSE" }, orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.lesson.groupBy({ by: ["courseId"], _max: { order: true } }),
  ]);
  const nextNumbers = Object.fromEntries(courses.map((c) => [c.id, 1]));
  for (const m of maxima) nextNumbers[m.courseId] = Math.max(0, m._max.order ?? 0) + 1;
  return { courses, categories, nextNumbers };
}
