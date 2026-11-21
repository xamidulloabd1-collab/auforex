"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpenIcon, CheckCircle2Icon, SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { BookCover } from "./book-cover";

export type BrowserBook = {
  id: string;
  slug: string;
  title: string;
  author: string | null;
  description: string | null;
  pageCount: number | null;
  coverUrl: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  currentPage: number;
  percent: number;
  completed: boolean;
};

export function BooksBrowser({ books, categories }: { books: BrowserBook[]; categories: { slug: string; name: string }[] }) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const q = React.useDeferredValue(query).trim().toLowerCase();

  const filtered = books.filter((b) => {
    if (category !== "all" && b.categorySlug !== category) return false;
    if (!q) return true;
    return [b.title, b.author ?? "", b.description ?? ""].some((s) => s.toLowerCase().includes(q));
  });

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Kitob yoki muallif…" className="pl-10" aria-label="Kitoblarni qidirish" data-testid="book-search" />
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
        <EmptyState className="mt-10" icon={<SearchIcon />} title="Kitob topilmadi" description="Boshqa kalit so‘z yoki kategoriyani tanlang." />
      ) : (
        <ul className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((b) => (
            <li key={b.id} className="card-surface flex gap-5 p-5" data-testid="book-card">
              <Link href={`/books/${b.slug}`} className="w-28 shrink-0 sm:w-32" aria-label={`${b.title} — o‘qish`}>
                <BookCover title={b.title} author={b.author} coverUrl={b.coverUrl} sizes="128px" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                {b.categoryName && <p className="font-mono text-[11px] tracking-[0.14em] text-gold-soft uppercase">{b.categoryName}</p>}
                <h3 className="mt-1 font-display text-lg leading-snug font-bold">{b.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[b.author, b.pageCount ? `${b.pageCount} bet` : null].filter(Boolean).join(" · ") || "Muallif ko‘rsatilmagan"}
                </p>
                {b.description && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{b.description}</p>}
                <div className="mt-auto pt-4">
                  {b.percent > 0 && (
                    <div className="mb-3 flex items-center gap-3">
                      <Progress value={b.percent} className="h-1.5" />
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {b.completed ? <CheckCircle2Icon className="size-4 text-success" /> : `${b.percent}%`}
                      </span>
                    </div>
                  )}
                  <Button asChild size="sm" variant={b.percent > 0 && !b.completed ? "default" : "secondary"}>
                    <Link href={`/books/${b.slug}`}>
                      <BookOpenIcon /> {b.percent > 0 && !b.completed ? `Davom ettirish · ${b.currentPage}-bet` : "O‘qish"}
                    </Link>
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
