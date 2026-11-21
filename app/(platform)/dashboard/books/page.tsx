import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getBookCatalog } from "@/lib/data/learning";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/empty-state";
import { BookCover } from "@/components/books/book-cover";
import { DashTitle } from "@/components/dashboard/stat-card";

export const metadata: Metadata = { title: "Mening kitoblarim", robots: { index: false } };

export default async function MyBooksPage() {
  const viewer = await requireUser("/dashboard/books");
  if (!viewer.hasPremium) {
    return (
      <>
        <DashTitle title="Mening kitoblarim" />
        <EmptyState icon={<BookOpenIcon />} title="Kutubxona PRO tarifda" description="Kitoblarni o‘qish uchun PRO obuna kerak." action={<Button asChild><Link href="/subscription">PRO haqida</Link></Button>} />
      </>
    );
  }
  const { books, continueReading } = await getBookCatalog(viewer.id);
  return (
    <>
      <DashTitle title="Mening kitoblarim" description="Mavjud kitoblar va o‘qish jarayoningiz." />
      {continueReading.length > 0 && (
        <section className="mb-10" aria-labelledby="continue-reading">
          <h2 id="continue-reading" className="font-display text-lg font-bold">
            O‘qishni davom ettirish
          </h2>
          <ul className="mt-4 grid gap-2">
            {continueReading.map((b) => (
              <li key={b.id}>
                <Link href={`/books/${b.slug}`} className="card-surface flex items-center gap-4 p-4 hover:border-primary/40">
                  <BookOpenIcon className="size-5 text-gold-soft" />
                  <span className="min-w-0 flex-1 truncate">{b.title}</span>
                  <span className="font-mono text-xs text-muted-foreground">{b.currentPage}-bet</span>
                  <Progress value={b.percent} className="h-1.5 w-24" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="all-books">
        <h2 id="all-books" className="font-display text-lg font-bold">
          Mavjud kitoblar
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
          {books.map((b) => (
            <li key={b.id}>
              <Link href={`/books/${b.slug}`} className="group block">
                <BookCover title={b.title} author={b.author} coverUrl={b.coverUrl} sizes="200px" className="transition-transform group-hover:-translate-y-1" />
                <p className="mt-3 line-clamp-2 text-sm font-semibold">{b.title}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Progress value={b.percent} className="h-1" />
                  <span className="font-mono text-[11px] text-muted-foreground">{b.percent}%</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
