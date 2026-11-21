import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, AwardIcon, BookOpenIcon, CrownIcon, PlayCircleIcon, TrophyIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getDashboardOverview } from "@/lib/data/dashboard";
import { EXPERIENCE_LABELS } from "@/lib/constants";
import { SUBSCRIPTION_LABELS } from "@/lib/subscription/entitlement";
import { formatDate, initials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/empty-state";
import { DashTitle, StatCard } from "@/components/dashboard/stat-card";

export const metadata: Metadata = { title: "Shaxsiy kabinet", robots: { index: false } };

export default async function DashboardOverviewPage() {
  const viewer = await requireUser("/dashboard");
  const data = await getDashboardOverview(viewer.id);
  const firstName = viewer.name.split(" ")[0];
  const isPro = viewer.subscription.status === "PRO_ACTIVE";

  return (
    <>
      <DashTitle title={`Xush kelibsiz, ${firstName}!`} description="O‘qishingiz qayerda turganini shu yerdan kuzating." />

      <section className="card-surface flex flex-col gap-6 p-6 sm:flex-row sm:items-center" aria-label="Profil">
        <Avatar className="size-16">
          {viewer.image && <AvatarImage src={viewer.image} alt="" />}
          <AvatarFallback className="text-base">{initials(viewer.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl font-bold">{viewer.name}</p>
          <p className="truncate text-sm text-muted-foreground">{viewer.email}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant={isPro ? "default" : "secondary"} data-testid="dashboard-plan">
              <CrownIcon /> {SUBSCRIPTION_LABELS[viewer.subscription.status]}
            </Badge>
            {viewer.isAdmin && <Badge variant="outline">Administrator</Badge>}
            {data.profile?.experienceLevel && <Badge variant="outline">{EXPERIENCE_LABELS[data.profile.experienceLevel]}</Badge>}
            <Badge variant="outline">A’zo: {formatDate(viewer.createdAt)}</Badge>
          </div>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/dashboard/settings">Profilni tahrirlash</Link>
        </Button>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="O‘rganish progressi"
          icon={<PlayCircleIcon />}
          value={`${data.learning.percent}%`}
          hint={
            <>
              <Progress value={data.learning.percent} className="mb-2 h-1.5" />
              {data.learning.completed}/{data.learning.total} dars yakunlangan
            </>
          }
        />
        <StatCard label="O‘qilayotgan kitoblar" icon={<BookOpenIcon />} value={data.recentBooks.length} hint="So‘nggi ochilgan kitoblar" />
        <StatCard label="Challenge topshiriqlari" icon={<TrophyIcon />} value={data.submissions} hint="Yuborilgan topshiriqlar" />
        <StatCard label="Yutuqlar" icon={<AwardIcon />} value={data.achievements} hint="Qo‘lga kiritilgan nishonlar" />
      </div>

      {!viewer.hasPremium && (
        <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-primary/30 bg-primary/[0.07] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-lg font-bold">PRO bilan barcha materiallarni oching</p>
            <p className="mt-1 text-sm text-muted-foreground">Videodarsliklar, kitoblar va challenge’lar PRO tarifda.</p>
          </div>
          <Button asChild>
            <Link href="/subscription">
              <CrownIcon /> PRO haqida
            </Link>
          </Button>
        </section>
      )}

      <div className="mt-10 grid grid-cols-1 gap-8 xl:grid-cols-2">
        <section aria-labelledby="recent-lessons" className="min-w-0">
          <div className="flex items-center justify-between">
            <h2 id="recent-lessons" className="font-display text-lg font-bold">
              So‘nggi darslar
            </h2>
            <Link href="/dashboard/learning" className="inline-flex items-center gap-1 text-sm text-gold-soft hover:underline">
              Barchasi <ArrowRightIcon className="size-3.5" />
            </Link>
          </div>
          {data.recentLessons.length === 0 ? (
            <EmptyState className="mt-4 py-10" icon={<PlayCircleIcon />} title="Hali dars ko‘rilmagan" action={<Button asChild size="sm"><Link href="/lessons">Darslarga o‘tish</Link></Button>} />
          ) : (
            <ul className="mt-4 grid gap-2">
              {data.recentLessons.map((l) => (
                <li key={l.slug}>
                  <Link href={`/lessons/${l.slug}`} className="card-surface flex items-center gap-4 p-4 transition-colors hover:border-primary/40">
                    <PlayCircleIcon className="size-6 shrink-0 text-gold-soft" strokeWidth={1.5} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{l.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{l.courseTitle}</p>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{l.percent}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="recent-books" className="min-w-0">
          <div className="flex items-center justify-between">
            <h2 id="recent-books" className="font-display text-lg font-bold">
              So‘nggi ochilgan kitoblar
            </h2>
            <Link href="/dashboard/books" className="inline-flex items-center gap-1 text-sm text-gold-soft hover:underline">
              Barchasi <ArrowRightIcon className="size-3.5" />
            </Link>
          </div>
          {data.recentBooks.length === 0 ? (
            <EmptyState className="mt-4 py-10" icon={<BookOpenIcon />} title="Hali kitob ochilmagan" action={<Button asChild size="sm"><Link href="/books">Kutubxonaga o‘tish</Link></Button>} />
          ) : (
            <ul className="mt-4 grid gap-2">
              {data.recentBooks.map((b) => (
                <li key={b.slug}>
                  <Link href={`/books/${b.slug}`} className="card-surface flex items-center gap-4 p-4 transition-colors hover:border-primary/40">
                    <BookOpenIcon className="size-6 shrink-0 text-gold-soft" strokeWidth={1.5} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{b.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.currentPage}-bet{b.totalPages ? ` / ${b.totalPages}` : ""}
                      </p>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{b.percent}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
