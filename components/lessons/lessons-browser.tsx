"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2Icon, ClockIcon, LockIcon, SearchIcon, XIcon } from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/empty-state";
import { LessonThumb } from "./lesson-thumb";

export type BrowserLesson = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  courseTitle: string;
  courseSlug: string;
  categoryName: string | null;
  categorySlug: string | null;
  progressPercent: number;
  completed: boolean;
  number: number;
  isFree: boolean;
  /** "pro" = needs PRO, "sequence" = opens after the previous lesson is completed. */
  lockReason: "pro" | "sequence" | null;
  locked: boolean;
};

type Course = { id: string; slug: string; title: string; description: string | null; categoryName: string | null; lessonIds: string[] };

export function LessonsBrowser({
  lessons,
  courses,
  categories,
}: {
  lessons: BrowserLesson[];
  courses: Course[];
  categories: { slug: string; name: string }[];
}) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");
  const deferredQuery = React.useDeferredValue(query);

  const filtered = React.useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return lessons.filter((l) => {
      if (category !== "all" && l.categorySlug !== category) return false;
      if (!q) return true;
      return [l.title, l.description ?? "", l.courseTitle].some((s) => s.toLowerCase().includes(q));
    });
  }, [lessons, deferredQuery, category]);

  const visibleIds = new Set(filtered.map((l) => l.id));
  const byId = new Map(lessons.map((l) => [l.id, l]));

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Darslarni qidirish…"
            className="pl-10"
            aria-label="Darslarni qidirish"
            data-testid="lesson-search"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Qidiruvni tozalash">
              <XIcon className="size-4" />
            </button>
          )}
        </div>
        {categories.length > 0 && (
          <div role="tablist" aria-label="Kategoriya" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {[{ slug: "all", name: "Barchasi" }, ...categories].map((c) => (
              <button
                key={c.slug}
                type="button"
                role="tab"
                aria-selected={category === c.slug}
                onClick={() => setCategory(c.slug)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors",
                  category === c.slug ? "border-primary/50 bg-primary/10 text-gold-soft" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState className="mt-10" icon={<SearchIcon />} title="Hech narsa topilmadi" description="Boshqa kalit so‘z yoki kategoriyani tanlab ko‘ring." />
      ) : (
        <div className="mt-10 space-y-14">
          {courses.map((course) => {
            const items = course.lessonIds.filter((id) => visibleIds.has(id)).map((id) => byId.get(id)!);
            if (items.length === 0) return null;
            const reachable = course.lessonIds.filter((id) => byId.get(id)?.lockReason !== "pro");
            const done = reachable.filter((id) => byId.get(id)?.completed).length;
            const pct = reachable.length ? Math.round((done / reachable.length) * 100) : 0;
            return (
              <section key={course.id} aria-labelledby={`course-${course.id}`}>
                <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    {course.categoryName && <p className="font-mono text-[11px] tracking-[0.16em] text-gold-soft uppercase">{course.categoryName}</p>}
                    <h2 id={`course-${course.id}`} className="mt-1 font-display text-2xl font-bold">
                      {course.title}
                    </h2>
                    {course.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{course.description}</p>}
                  </div>
                  <div className="w-full shrink-0 sm:w-48">
                    <p className="mb-1.5 text-right font-mono text-xs text-muted-foreground">
                      {done}/{reachable.length} · {pct}%
                    </p>
                    <Progress value={pct} />
                  </div>
                </div>
                <ul className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((l) => (
                    <li key={l.id}>
                      <Link
                        href={`/lessons/${l.slug}`}
                        className={cn("group block", l.locked && "opacity-60")}
                        data-testid="lesson-card"
                        data-locked={l.locked ? "true" : undefined}
                        data-lock-reason={l.lockReason ?? undefined}
                      >
                        <div className="relative">
                          <LessonThumb url={l.thumbnailUrl} title={l.title} />
                          {l.locked && (
                            <div className="absolute inset-0 grid place-items-center rounded-xl bg-black/55">
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1 text-xs">
                                <LockIcon className="size-3.5" /> {l.lockReason === "pro" ? "PRO" : "Yopiq"}
                              </span>
                            </div>
                          )}
                          {l.isFree && (
                            <span className="absolute top-2 left-2 rounded-full bg-success/90 px-2 py-0.5 text-[11px] font-semibold text-background">Bepul</span>
                          )}
                        </div>
                        <div className="mt-4 flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase" data-testid="lesson-number">
                              {l.categoryName && l.categoryName !== course.categoryName ? `${l.categoryName} — ` : ""}
                              {l.number}-dars
                            </p>
                            <h3 className="mt-0.5 line-clamp-2 font-display font-semibold transition-colors group-hover:text-gold-soft">{l.title}</h3>
                            {l.lockReason === "pro" ? (
                              <p className="mt-1 text-sm text-muted-foreground">PRO obuna bilan ochiladi.</p>
                            ) : l.lockReason === "sequence" ? (
                              <p className="mt-1 text-sm text-muted-foreground">Oldingi darsni yakunlagach ochiladi.</p>
                            ) : (
                              l.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{l.description}</p>
                            )}
                          </div>
                          {l.completed && <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-success" aria-label="Yakunlangan" />}
                          {l.locked && <LockIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-label="Yopiq" />}
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <ClockIcon className="size-3.5" /> {formatDuration(l.durationSeconds)}
                          </span>
                          {l.progressPercent > 0 && <Progress value={l.progressPercent} className="h-1.5 flex-1" />}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
