import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLinkIcon } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { lessonFormOptions } from "@/lib/data/lesson-admin";
import { storageStatus, uploadLimitBytes } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { AdminTitle } from "@/components/admin/admin-title";
import { LessonForm } from "@/components/admin/lesson-form";

export default async function EditLessonPage({ params }: PageProps<"/super-admin/lessons/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const [lesson, options] = await Promise.all([prisma.lesson.findUnique({ where: { id } }), lessonFormOptions()]);
  if (!lesson) notFound();
  return (
    <>
      <AdminTitle
        title="Darsni tahrirlash"
        description={lesson.title}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/lessons/${lesson.slug}`} target="_blank">
              Oldindan ko‘rish <ExternalLinkIcon />
            </Link>
          </Button>
        }
      />
      <LessonForm
        {...options}
        maxVideoBytes={uploadLimitBytes("video")}
        uploadsAvailable={storageStatus().uploads}
        lesson={{
          id: lesson.id,
          title: lesson.title,
          slug: lesson.slug,
          description: lesson.description ?? "",
          courseId: lesson.courseId,
          categoryId: lesson.categoryId ?? "",
          order: lesson.order,
          level: lesson.level,
          isFree: lesson.isFree,
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
