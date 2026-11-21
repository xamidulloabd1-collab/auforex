import Link from "next/link";
import { Trash2Icon } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { deleteCourse, saveCourse } from "@/lib/actions/admin/content";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminTitle } from "@/components/admin/admin-title";
import { ActionSwitch, ConfirmAction } from "@/components/admin/action-controls";
import { CategoryManager } from "@/components/admin/category-manager";
import { CourseDialog } from "@/components/admin/course-dialog";

export default async function AdminCoursesPage() {
  await requireAdmin();
  const [courses, categories] = await Promise.all([
    prisma.course.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        categoryId: true,
        order: true,
        isPublished: true,
        category: { select: { name: true } },
        _count: { select: { lessons: true } },
      },
    }),
    prisma.category.findMany({ where: { kind: "COURSE" }, orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true, order: true, _count: { select: { courses: true } } } }),
  ]);
  const cats = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <AdminTitle title="Kurslar" description="Darslar kurslar ichida guruhlanadi. Kurs nashr qilinmasa, uning darslari ham ko‘rinmaydi." actions={<CourseDialog categories={cats} />} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kurs</TableHead>
              <TableHead className="hidden md:table-cell">Kategoriya</TableHead>
              <TableHead className="hidden md:table-cell">Darslar</TableHead>
              <TableHead>Nashr</TableHead>
              <TableHead className="text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <span className="block font-medium">{c.title}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">#{c.order} · /{c.slug}</span>
                </TableCell>
                <TableCell className="hidden md:table-cell">{c.category ? <Badge variant="secondary">{c.category.name}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <Link href={`/super-admin/lessons?course=${c.id}`} className="text-gold-soft hover:underline">
                    {c._count.lessons} ta
                  </Link>
                </TableCell>
                <TableCell>
                  <ActionSwitch
                    checked={c.isPublished}
                    label={`${c.title} nashr holati`}
                    action={async (next) => {
                      "use server";
                      return saveCourse(c.id, { title: c.title, slug: c.slug, description: c.description ?? "", categoryId: c.categoryId ?? "", order: c.order, isPublished: next });
                    }}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-1">
                    <CourseDialog course={c} categories={cats} />
                    <ConfirmAction
                      action={async () => {
                        "use server";
                        return deleteCourse(c.id);
                      }}
                      title={`“${c.title}” o‘chirilsinmi?`}
                      description="Faqat darslari bo‘lmagan kursni o‘chirish mumkin."
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
            {courses.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Hali kurs yaratilmagan. Darslarni qo‘shishdan oldin kurs yarating.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <CategoryManager kind="COURSE" categories={categories.map((c) => ({ id: c.id, name: c.name, order: c.order, count: c._count.courses }))} />
      </div>
    </>
  );
}
