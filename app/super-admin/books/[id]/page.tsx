import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { uploadLimitBytes } from "@/lib/storage";
import { publicMediaUrl } from "@/lib/storage/keys";
import { AdminTitle } from "@/components/admin/admin-title";
import { BookForm } from "@/components/admin/book-form";

export default async function EditBookPage({ params }: PageProps<"/super-admin/books/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const [book, categories] = await Promise.all([
    prisma.book.findUnique({ where: { id } }),
    prisma.category.findMany({ where: { kind: "BOOK" }, orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  if (!book) notFound();
  return (
    <>
      <AdminTitle title="Kitobni tahrirlash" description={book.title} />
      <BookForm
        categories={categories}
        maxBookBytes={uploadLimitBytes("book")}
        coverUrl={publicMediaUrl(book.coverKey)}
        book={{
          id: book.id,
          title: book.title,
          slug: book.slug,
          author: book.author ?? "",
          description: book.description ?? "",
          pageCount: book.pageCount,
          categoryId: book.categoryId ?? "",
          fileKey: book.fileKey,
          fileSize: book.fileSize,
          coverKey: book.coverKey,
          order: book.order,
          isPublished: book.isPublished,
        }}
      />
    </>
  );
}
