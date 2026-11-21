import Link from "next/link";
import { ArrowRightIcon, ClockIcon, FilmIcon, LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/shared/page-header";
import { Reveal, Stagger, StaggerItem } from "@/components/shared/reveal";
import { BookCover } from "@/components/books/book-cover";
import { LessonThumb } from "@/components/lessons/lesson-thumb";
import { SUGGESTED_COURSE_CATEGORIES } from "@/lib/constants";
import { formatDuration } from "@/lib/utils";

type LessonPreview = {
  id: string;
  title: string;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  courseTitle: string;
  categoryName: string | null;
};

export function LessonsPreview({ lessons, hasPremium }: { lessons: LessonPreview[]; hasPremium: boolean }) {
  return (
    <section className="py-14 sm:py-20 md:py-24" aria-labelledby="lessons-preview-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            eyebrow="Video darsliklar"
            title={<span id="lessons-preview-title">Tizimli video darslar</span>}
            description="Darslar kurslar va yo‘nalishlar bo‘yicha tartiblangan, har birida o‘rganish jarayoningiz saqlanadi."
          />
          <Button asChild variant="outline">
            <Link href="/lessons">
              Barcha darslar <ArrowRightIcon />
            </Link>
          </Button>
        </div>

        {lessons.length > 0 ? (
          <Stagger className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {lessons.map((l) => (
              <StaggerItem key={l.id}>
                <Link href="/lessons" className="group block">
                  <LessonThumb url={l.thumbnailUrl} title={l.title} />
                  <div className="mt-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">{l.categoryName ?? l.courseTitle}</p>
                      <h3 className="mt-1 line-clamp-2 font-display font-semibold transition-colors group-hover:text-gold-soft">{l.title}</h3>
                    </div>
                    {!hasPremium && <LockIcon className="mt-1 size-4 shrink-0 text-muted-foreground" aria-label="PRO" />}
                  </div>
                  {l.durationSeconds ? (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ClockIcon className="size-3.5" /> {formatDuration(l.durationSeconds)}
                    </p>
                  ) : null}
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        ) : (
          <Reveal className="mt-12">
            <div className="card-surface flex flex-col gap-8 p-6 sm:p-10 lg:flex-row lg:items-center">
              <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-border-strong bg-surface text-gold-soft">
                <FilmIcon className="size-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-display text-xl font-bold">Video darslar tayyorlanmoqda</h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Darslar admin tomonidan joylangani sari shu yerda paydo bo‘ladi. Rejadagi yo‘nalishlar:
                </p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {SUGGESTED_COURSE_CATEGORIES.map((c) => (
                    <li key={c}>
                      <Badge variant="secondary" className="px-3 py-1 text-[13px]">
                        {c}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

type BookPreview = { id: string; title: string; author: string | null; pageCount: number | null; coverUrl: string | null; categoryName: string | null };

export function BooksPreview({ books }: { books: BookPreview[] }) {
  if (books.length === 0) return null;
  return (
    <section className="relative overflow-hidden border-y border-border bg-surface/40 py-14 sm:py-20 md:py-24" aria-labelledby="books-preview-title">
      <div aria-hidden className="absolute top-1/2 left-1/2 -z-0 h-72 w-[60rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.05] blur-3xl" />
      <div className="relative mx-auto grid grid-cols-1 max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:items-center lg:px-8">
        <div className="lg:col-span-5">
          <SectionHeading
            eyebrow="Trading kutubxonasi"
            title={<span id="books-preview-title">Kitoblar — platformaning o‘zida</span>}
            description="Tradingga oid kitoblarni qulay o‘quvchi orqali o‘qing. Qayerda to‘xtaganingiz saqlanadi."
          />
          <Button asChild className="mt-8">
            <Link href="/books">
              Kutubxonani ochish <ArrowRightIcon />
            </Link>
          </Button>
        </div>
        <Stagger className="grid grid-cols-3 gap-4 sm:gap-6 lg:col-span-7" gap={0.12}>
          {books.map((b, i) => (
            <StaggerItem key={b.id} className={i === 1 ? "sm:-translate-y-6" : ""}>
              <Link href="/books" className="group block">
                <BookCover title={b.title} author={b.author} coverUrl={b.coverUrl} className="transition-transform duration-500 group-hover:-translate-y-1.5 group-hover:rotate-[-1deg]" />
                <p className="mt-4 line-clamp-2 font-display text-sm font-semibold sm:text-base">{b.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[b.author, b.pageCount ? `${b.pageCount} bet` : null].filter(Boolean).join(" · ")}
                </p>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
