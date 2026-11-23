import { requireAdmin } from "@/lib/auth/session";
import { lessonFormOptions } from "@/lib/data/lesson-admin";
import { storageStatus, uploadLimitBytes } from "@/lib/storage";
import { AdminTitle } from "@/components/admin/admin-title";
import { LessonForm } from "@/components/admin/lesson-form";

export default async function NewLessonPage({ searchParams }: PageProps<"/super-admin/lessons/new">) {
  await requireAdmin();
  const sp = await searchParams;
  const options = await lessonFormOptions();
  return (
    <>
      <AdminTitle title="Yangi video dars" />
      <LessonForm
        {...options}
        defaultCourseId={typeof sp.course === "string" ? sp.course : undefined}
        maxVideoBytes={uploadLimitBytes("video")}
        uploadsAvailable={storageStatus().uploads}
      />
    </>
  );
}
