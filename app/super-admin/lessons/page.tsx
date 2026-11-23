import Link from "next/link";
import { ArrowDownIcon, ArrowUpIcon, EyeIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { deleteLesson, moveLesson, setLessonPublished } from "@/lib/actions/admin/content";
import type { Prisma } from "@/lib/db/generated/client";
import { formatDuration } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { AdminTitle } from "@/components/admin/admin-title";
import { ActionButton, ActionSwitch, ConfirmAction } from "@/components/admin/action-controls";
import { LEVEL_LABELS } from "@/lib/constants";

export default async function AdminLessonsPage({ searchParams }: PageProps<"/super-admin/lessons">) {
  await requireAdmin();
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const courseId = pick("course");
  const categoryId = pick("category");
  const q = pick("q").trim().slice(0, 100);
  const status = pick("status");
  const where: Prisma.LessonWhereInput = {
    ...(courseId ? { courseId } : {}),
    ...(categoryId === "none" ? { categoryId: null } : categoryId ? { categoryId } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    ...(status === "draft" ? { isPublished: false } : status === "published" ? { isPublished: true } : {}),
    ...(status === "free" ? { isFree: true } : status === "pro" ? { isFree: false } : {}),
  };
  const [courses, categories, lessons, total] = await Promise.all([
    prisma.course.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, title: true } }),
    prisma.category.findMany({ where: { kind: "COURSE" }, orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.lesson.findMany({
      where,
      orderBy: [{ course: { order: "asc" } }, { course: { createdAt: "asc" } }, { order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        order: true,
        isPublished: true,
        isFree: true,
        level: true,
        durationSeconds: true,
        videoSource: true,
        videoKey: true,
        embedUrl: true,
        course: { select: { title: true } },
        category: { select: { name: true } },
        _count: { select: { progress: true } },
      },
    }),
    prisma.lesson.count(),
  ]);
  const filtered = Boolean(courseId || categoryId || q || status);

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
        description={filtered ? `${lessons.length} ta dars topildi (jami ${total})` : `${total} ta dars`}
        actions={
          <Button asChild data-testid="new-lesson">
            <Link href={`/super-admin/lessons/new${courseId ? `?course=${courseId}` : ""}`}>
              <PlusIcon /> Yangi dars
            </Link>
          </Button>
        }
      />
      <form className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_200px_200px_170px_auto]" data-testid="lesson-filters">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Dars nomi bo‘yicha qidirish" className="pl-9" aria-label="Qidirish" />
        </div>
        <NativeSelect name="category" defaultValue={categoryId} aria-label="Kategoriya bo‘yicha filtr">
          <option value="">Barcha kategoriyalar</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">Kategoriyasiz</option>
        </NativeSelect>
        <NativeSelect name="course" defaultValue={courseId} aria-label="Kurs bo‘yicha filtr">
          <option value="">Barcha kurslar</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="status" defaultValue={status} aria-label="Holat bo‘yicha filtr">
          <option value="">Barcha holatlar</option>
          <option value="published">Nashr qilingan</option>
          <option value="draft">Qoralama</option>
          <option value="pro">PRO</option>
          <option value="free">Bepul</option>
        </NativeSelect>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary">
            Filtrlash
          </Button>
          {filtered && (
            <Button asChild variant="ghost">
              <Link href="/super-admin/lessons">Tozalash</Link>
            </Button>
          )}
        </div>
      </form>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">№</TableHead>
            <TableHead>Dars</TableHead>
            <TableHead className="hidden lg:table-cell">Kurs</TableHead>
            <TableHead className="hidden md:table-cell">Video</TableHead>
            <TableHead className="hidden sm:table-cell">Huquq</TableHead>
            <TableHead>Nashr</TableHead>
            <TableHead className="text-right">Amallar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lessons.map((l) => (
            <TableRow key={l.id} data-testid="admin-lesson-row">
              <TableCell className="font-mono text-sm text-gold-soft">{l.order}-dars</TableCell>
              <TableCell>
                <span className="block font-medium">{l.title}</span>
                <span className="text-xs text-muted-foreground">
                  {[l.category?.name ?? "Kategoriyasiz", formatDuration(l.durationSeconds), l.level ? LEVEL_LABELS[l.level] : null, l._count.progress ? `${l._count.progress} o‘quvchi` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">{l.course.title}</TableCell>
              <TableCell className="hidden md:table-cell">
                {l.videoSource === "UPLOAD" ? (
                  l.videoKey ? <Badge variant="success">Yuklangan</Badge> : <Badge variant="warning">Video yo‘q</Badge>
                ) : (
                  <Badge variant="secondary">{l.embedUrl?.includes("mediadelivery.net") ? "Bunny" : "Havola"}</Badge>
                )}
              </TableCell>
              <TableCell className="hidden sm:table-cell">{l.isFree ? <Badge variant="secondary">Bepul</Badge> : <Badge>PRO</Badge>}</TableCell>
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
                  <Button asChild variant="ghost" size="icon-sm" aria-label="Oldindan ko‘rish">
                    <Link href={`/lessons/${l.slug}`} target="_blank">
                      <EyeIcon />
                    </Link>
                  </Button>
                  {!filtered || courseId ? (
                    <>
                      <ActionButton variant="ghost" size="icon-sm" aria-label="Yuqoriga" action={async () => { "use server"; return moveLesson(l.id, "up"); }}>
                        <ArrowUpIcon />
                      </ActionButton>
                      <ActionButton variant="ghost" size="icon-sm" aria-label="Pastga" action={async () => { "use server"; return moveLesson(l.id, "down"); }}>
                        <ArrowDownIcon />
                      </ActionButton>
                    </>
                  ) : null}
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
                    description={`Dars va uning video fayli o‘chiriladi${l._count.progress ? `, ${l._count.progress} ta foydalanuvchining shu darsdagi progressi ham o‘chadi` : ""}. Bu amalni qaytarib bo‘lmaydi.`}
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
              <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                {filtered ? "Bu filtr bo‘yicha dars topilmadi." : "Hali dars qo‘shilmagan."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
