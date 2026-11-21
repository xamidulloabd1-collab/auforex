import Link from "next/link";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { deleteBook, setBookPublished } from "@/lib/actions/admin/content";
import { publicMediaUrl } from "@/lib/storage/keys";
import { formatBytes } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookCover } from "@/components/books/book-cover";
import { AdminTitle } from "@/components/admin/admin-title";
import { ActionSwitch, ConfirmAction } from "@/components/admin/action-controls";
import { CategoryManager } from "@/components/admin/category-manager";

export default async function AdminBooksPage() {
  await requireAdmin();
  const [books, categories] = await Promise.all([
    prisma.book.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, author: true, pageCount: true, fileSize: true, coverKey: true, isPublished: true, category: { select: { name: true } }, _count: { select: { progress: true } } },
    }),
    prisma.category.findMany({ where: { kind: "BOOK" }, orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true, order: true, _count: { select: { books: true } } } }),
  ]);
  return (
    <>
      <AdminTitle
        title="Kitoblar"
        description="PDF fayllar himoyalangan saqlovda; faqat PRO foydalanuvchilar ilova ichidagi o‘quvchi orqali ochadi."
        actions={
          <Button asChild data-testid="new-book">
            <Link href="/super-admin/books/new">
              <PlusIcon /> Kitob qo‘shish
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kitob</TableHead>
              <TableHead className="hidden md:table-cell">Kategoriya</TableHead>
              <TableHead className="hidden md:table-cell">O‘quvchilar</TableHead>
              <TableHead>Nashr</TableHead>
              <TableHead className="text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {books.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <BookCover title={b.title} coverUrl={publicMediaUrl(b.coverKey)} className="w-10 shrink-0 rounded-sm" sizes="40px" />
                    <div>
                      <span className="block font-medium">{b.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {[b.author, b.pageCount ? `${b.pageCount} bet` : null, formatBytes(b.fileSize)].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{b.category ? <Badge variant="secondary">{b.category.name}</Badge> : "—"}</TableCell>
                <TableCell className="hidden md:table-cell font-mono text-sm">{b._count.progress}</TableCell>
                <TableCell>
                  <ActionSwitch checked={b.isPublished} label={`${b.title} nashr holati`} action={async (next) => { "use server"; return setBookPublished(b.id, next); }} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-1">
                    <Button asChild variant="ghost" size="icon-sm" aria-label="Tahrirlash">
                      <Link href={`/super-admin/books/${b.id}`}>
                        <PencilIcon />
                      </Link>
                    </Button>
                    <ConfirmAction
                      action={async () => {
                        "use server";
                        return deleteBook(b.id);
                      }}
                      title={`“${b.title}” o‘chirilsinmi?`}
                      description="PDF fayl, muqova va o‘qish progresslari o‘chiriladi."
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
            {books.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Hali kitob qo‘shilmagan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <CategoryManager kind="BOOK" categories={categories.map((c) => ({ id: c.id, name: c.name, order: c.order, count: c._count.books }))} />
      </div>
    </>
  );
}
