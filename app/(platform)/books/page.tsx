import type { Metadata } from "next";
import Link from "next/link";
import { LibraryIcon } from "lucide-react";
import { getViewer } from "@/lib/auth/session";
import { getBookCatalog } from "@/lib/data/learning";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Progress } from "@/components/ui/progress";
import { ProAccessGate } from "@/components/subscription/pro-access-gate";
import { BooksBrowser } from "@/components/books/books-browser";

export const metadata: Metadata = { title: "Kitoblar", description: "Tradingga oid kitoblar kutubxonasi — platformaning o‘zida o‘qing." };

export default async function BooksPage() {
  const viewer = await getViewer();
  if (!viewer?.hasPremium) {
    return (
      <>
        <PageHeader eyebrow="Kutubxona" title="Trading kutubxonasi" description="Tradingga oid kitoblar va o‘quv materiallari." />
        <div className="px-4 py-16 sm:px-6">
          <ProAccessGate isGuest={!viewer} />
        </div>
      </>
    );
  }
  const { books, categories, continueReading } = await getBookCatalog(viewer.id);

  return (
    <>
      <PageHeader eyebrow="Kutubxona" title="Trading kutubxonasi" description="Kitoblarni platformaning o‘zida o‘qing — qaysi betda to‘xtaganingiz saqlanadi." />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {continueReading.length > 0 && (
          <section aria-labelledby="continue-reading" className="mb-12">
            <h2 id="continue-reading" className="font-mono text-[11px] font-medium tracking-[0.22em] text-muted-foreground uppercase">
              O‘qishni davom ettirish
            </h2>
            <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {continueReading.map((b) => (
                <li key={b.id}>
                  <Link href={`/books/${b.slug}`} className="card-surface flex items-center gap-4 p-4 transition-colors hover:border-primary/40">
                    <LibraryIcon className="size-8 shrink-0 text-gold-soft" strokeWidth={1.4} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display font-semibold">{b.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.currentPage}-bet{b.pageCount ? ` / ${b.pageCount}` : ""}
                      </p>
                      <Progress value={b.percent} className="mt-2 h-1.5" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {books.length === 0 ? (
          <EmptyState icon={<LibraryIcon />} title="Kutubxona hozircha bo‘sh" description="Kitoblar admin tomonidan joylangach shu yerda paydo bo‘ladi." />
        ) : (
          <BooksBrowser books={books} categories={categories} />
        )}
        <p className="mt-12 text-xs leading-relaxed text-muted-foreground">
          Kitoblar mualliflik huquqi egalariga tegishli. Materiallar faqat platforma ichida shaxsiy o‘qish uchun taqdim etiladi; ularni tarqatish taqiqlanadi.
        </p>
      </div>
    </>
  );
}
