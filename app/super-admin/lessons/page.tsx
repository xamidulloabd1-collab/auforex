import Link from "next/link";
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { deleteLesson, moveLesson, setLessonPublished } from "@/lib/actions/admin/content";
import { formatDuration } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { AdminTitle } from "@/components/admin/admin-title";
import { ActionButton, ActionSwitch, ConfirmAction } from "@/components/admin/action-controls";

export default async function AdminLessonsPage({ searchParams }: PageProps<"/super-admin/lessons">) {
  await requireAdmin();
  const sp = await searchParams;
  const courseId = typeof sp.course === "string" ? sp.course : "";
  const [courses, lessons] = await Promise.all([
    prisma.course.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, title: true } }),
    prisma.lesson.findMany({
      where: courseId ? { courseId } : {},
      orderBy: [{ course: { order: "asc" } }, { course: { createdAt: "asc" } }, { order: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, slug: true, order: true, isPublished: true, durationSeconds: true, videoSource: true, videoKey: true, embedUrl: true, course: { select: { title: true } } },
    }),
  ]);

  if (courses.length === 0) {
    return (
      <>
        <AdminTitle title="Video darslar" />
        <EmptyState title="Avval kurs yarating" description="Har bir dars kursga tegishli bo‘ladi." action={<Button asChild><Link href="/super-admin/courses">Kurslar bo‘limi</Link></Button>} />
      </>
    );
  }

  return (
    <>
      <AdminTitle
        title="Video darslar"
        description={`${lessons.length} ta dars`}
        actions={
          <Button asChild data-testid="new-lesson">
            <Link href={`/super-admin/lessons/new${courseId ? `?course=${courseId}` : ""}`}>
              <PlusIcon /> Yangi dars
            </Link>
          </Button>
        }
      />
      <form className="mb-6 flex gap-3">
        <NativeSelect name="course" defaultValue={courseId} aria-label="Kurs bo‘yicha filtr" className="sm:w-72">
          <option value="">Barcha kurslar</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Filtrlash
        </Button>
      </form>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Dars</TableHead>
            <TableHead className="hidden md:table-cell">Kurs</TableHead>
            <TableHead className="hidden md:table-cell">Video</TableHead>
            <TableHead>Nashr</TableHead>
            <TableHead className="text-right">Amallar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lessons.map((l) => (
            <TableRow key={l.id}>
              <TableCell>
                <span className="block font-medium">{l.title}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  #{l.order} · {formatDuration(l.durationSeconds)}
                </span>
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">{l.course.title}</TableCell>
              <TableCell className="hidden md:table-cell">
                {l.videoSource === "UPLOAD" ? (
                  l.videoKey ? <Badge variant="success">Yuklangan</Badge> : <Badge variant="warning">Video yo‘q</Badge>
                ) : (
                  <Badge variant="secondary">Tashqi havola</Badge>
                )}
              </TableCell>
              <TableCell>
                <ActionSwitch
                  checked={l.isPublished}
                  label={`${l.title} nashr holati`}
                  action={async (next) => {
                    "use server";
                    return setLessonPublished(l.id, next);
                  }}
                />
              </TableCell>
              <TableCell className="text-right">
                <div className="inline-flex gap-1">
                  <ActionButton variant="ghost" size="icon-sm" aria-label="Yuqoriga" action={async () => { "use server"; return moveLesson(l.id, "up"); }}>
                    <ArrowUpIcon />
                  </ActionButton>
                  <ActionButton variant="ghost" size="icon-sm" aria-label="Pastga" action={async () => { "use server"; return moveLesson(l.id, "down"); }}>
                    <ArrowDownIcon />
                  </ActionButton>
                  <Button asChild variant="ghost" size="icon-sm" aria-label="Tahrirlash">
                    <Link href={`/super-admin/lessons/${l.id}`}>
                      <PencilIcon />
                    </Link>
                  </Button>
                  <ConfirmAction
                    action={async () => {
                      "use server";
                      return deleteLesson(l.id);
                    }}
                    title={`“${l.title}” o‘chirilsinmi?`}
                    description="Dars, uning video fayli va foydalanuvchilar progressi o‘chiriladi."
                    confirmLabel="O‘chirish"
                    variant="ghost"
                    size="icon-sm"
                  >
                    <Trash2Icon />
                  </ConfirmAction>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {lessons.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                Hali dars qo‘shilmagan.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
