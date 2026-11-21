import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2Icon, PlayCircleIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyLearning } from "@/lib/data/dashboard";
import { formatDate, formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/empty-state";
import { DashTitle } from "@/components/dashboard/stat-card";

export const metadata: Metadata = { title: "Mening darslarim", robots: { index: false } };

export default async function MyLearningPage() {
  const viewer = await requireUser("/dashboard/learning");
  const data = await getMyLearning(viewer.id);

  if (data.courses.length === 0) {
    return (
      <>
        <DashTitle title="Mening darslarim" />
        <EmptyState
          icon={<PlayCircleIcon />}
          title="Siz hali kursni boshlamagansiz"
          description={viewer.hasPremium ? "Birinchi darsni ochganingizdan so‘ng kurslar va progress shu yerda ko‘rinadi." : "Videodarsliklar PRO tarifda mavjud."}
          action={
            <Button asChild>
              <Link href={viewer.hasPremium ? "/lessons" : "/subscription"}>{viewer.hasPremium ? "Darslarga o‘tish" : "PRO haqida"}</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <DashTitle title="Mening darslarim" description="Boshlangan kurslar, davom ettiriladigan va yakunlangan darslar." />
      <section aria-labelledby="my-courses">
        <h2 id="my-courses" className="font-display text-lg font-bold">
          Boshlangan kurslar
        </h2>
        <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {data.courses.map((c) => (
            <li key={c.id} className="card-surface p-5">
              {c.categoryName && <p className="font-mono text-[11px] tracking-[0.14em] text-gold-soft uppercase">{c.categoryName}</p>}
              <p className="mt-1 font-display text-lg font-bold">{c.title}</p>
              <div className="mt-4 flex items-center gap-3">
                <Progress value={c.percent} className="h-1.5" />
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {c.completed}/{c.total}
                </span>
              </div>
              {c.nextSlug && (
                <Button asChild size="sm" variant="secondary" className="mt-4">
                  <Link href={`/lessons/${c.nextSlug}`}>{c.percent === 100 ? "Qayta ko‘rish" : "Davom ettirish"}</Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {data.continueWatching.length > 0 && (
        <section className="mt-10" aria-labelledby="continue">
          <h2 id="continue" className="font-display text-lg font-bold">
            Davom ettirish
          </h2>
          <ul className="mt-4 grid gap-2">
            {data.continueWatching.map((l) => (
              <li key={l.slug}>
                <Link href={`/lessons/${l.slug}`} className="card-surface flex items-center gap-4 p-4 hover:border-primary/40">
                  <PlayCircleIcon className="size-5 text-gold-soft" />
                  <span className="min-w-0 flex-1 truncate">{l.title}</span>
                  <Progress value={l.percent} className="h-1.5 w-24" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10" aria-labelledby="completed">
        <h2 id="completed" className="font-display text-lg font-bold">
          Yakunlangan darslar ({data.completed.length})
        </h2>
        {data.completed.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Hali yakunlangan dars yo‘q.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {data.completed.map((l) => (
              <li key={l.slug}>
                <Link href={`/lessons/${l.slug}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-secondary/40">
                  <CheckCircle2Icon className="size-4 shrink-0 text-success" />
                  <span className="min-w-0 flex-1 truncate">{l.title}</span>
                  <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{formatDuration(l.durationSeconds)}</span>
                  <span className="font-mono text-xs text-muted-foreground">{formatDate(l.completedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
