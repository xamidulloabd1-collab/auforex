import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLinkIcon } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { uploadLimitBytes } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { AdminTitle } from "@/components/admin/admin-title";
import { LessonForm } from "@/components/admin/lesson-form";

export default async function EditLessonPage({ params }: PageProps<"/super-admin/lessons/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const [lesson, courses] = await Promise.all([
    prisma.lesson.findUnique({ where: { id } }),
    prisma.course.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, title: true } }),
  ]);
  if (!lesson) notFound();
  return (
    <>
      <AdminTitle
        title="Darsni tahrirlash"
        description={lesson.title}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/lessons/${lesson.slug}`} target="_blank">
              Ko‘rish <ExternalLinkIcon />
            </Link>
          </Button>
        }
      />
      <LessonForm
        courses={courses}
        maxVideoBytes={uploadLimitBytes("video")}
        lesson={{
          id: lesson.id,
          title: lesson.title,
          slug: lesson.slug,
          description: lesson.description ?? "",
          courseId: lesson.courseId,
          order: lesson.order,
          durationSeconds: lesson.durationSeconds,
          videoSource: lesson.videoSource,
          videoKey: lesson.videoKey,
          embedUrl: lesson.embedUrl ?? "",
          thumbnailKey: lesson.thumbnailKey,
          isPublished: lesson.isPublished,
        }}
      />
    </>
  );
}
