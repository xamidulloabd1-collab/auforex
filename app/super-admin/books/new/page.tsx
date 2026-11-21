import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { uploadLimitBytes } from "@/lib/storage";
import { AdminTitle } from "@/components/admin/admin-title";
import { BookForm } from "@/components/admin/book-form";

export default async function NewBookPage() {
  await requireAdmin();
  const categories = await prisma.category.findMany({ where: { kind: "BOOK" }, orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true } });
  return (
    <>
      <AdminTitle title="Kitob qo‘shish" />
      <BookForm categories={categories} maxBookBytes={uploadLimitBytes("book")} />
    </>
  );
}
