import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AdminTitle } from "@/components/admin/admin-title";
import { CategoryManager } from "@/components/admin/category-manager";

export const metadata: Metadata = { title: "Kategoriyalar" };

export default async function AdminCategoriesPage() {
  await requireAdmin();
  const [lessonCats, bookCats] = await Promise.all([
    prisma.category.findMany({
      where: { kind: "COURSE" },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, order: true, _count: { select: { lessons: true, courses: true } } },
    }),
    prisma.category.findMany({
      where: { kind: "BOOK" },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, order: true, _count: { select: { books: true } } },
    }),
  ]);
  return (
    <>
      <AdminTitle
        title="Kategoriyalar"
        description="Darslar sayt va ro‘yxatlarda shu tartibda guruhlanadi. Ishlatilayotgan kategoriyani o‘chirib bo‘lmaydi — avval kontentni boshqasiga o‘tkazing."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CategoryManager
          kind="COURSE"
          title="Video dars kategoriyalari"
          reorder
          categories={lessonCats.map((c) => ({
            id: c.id,
            name: c.name,
            order: c.order,
            count: c._count.lessons + c._count.courses,
            countLabel: `${c._count.lessons} dars · ${c._count.courses} kurs`,
          }))}
        />
        <CategoryManager
          kind="BOOK"
          title="Kitob kategoriyalari"
          reorder
          categories={bookCats.map((c) => ({ id: c.id, name: c.name, order: c.order, count: c._count.books, countLabel: `${c._count.books} kitob` }))}
        />
      </div>
    </>
  );
}
