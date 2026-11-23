import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isReadOnlyHost, uploadLimitBytes } from "@/lib/storage";
import { AdminTitle } from "@/components/admin/admin-title";
import { LessonForm } from "@/components/admin/lesson-form";

export default async function NewLessonPage({ searchParams }: PageProps<"/super-admin/lessons/new">) {
  await requireAdmin();
  const sp = await searchParams;
  const courses = await prisma.course.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, title: true } });
  return (
    <>
      <AdminTitle title="Yangi dars" />
      <LessonForm courses={courses} defaultCourseId={typeof sp.course === "string" ? sp.course : undefined} maxVideoBytes={uploadLimitBytes("video")} uploadsAvailable={!isReadOnlyHost()} />
    </>
  );
}
