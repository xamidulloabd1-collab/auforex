import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircle2Icon, LockIcon, PlayIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getLessonForViewer } from "@/lib/data/learning";
import { LEVEL_LABELS } from "@/lib/constants";
import { cn, formatDuration } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProAccessGate } from "@/components/subscription/pro-access-gate";
import { LessonPlayer } from "@/components/lessons/lesson-player";

export const metadata: Metadata = { title: "Dars", robots: { index: false } };

export default async function LessonPage({ params }: PageProps<"/lessons/[slug]">) {
  const { slug } = await params;
  const viewer = await requireUser(`/lessons/${slug}`);
  const data = await getLessonForViewer(slug, { userId: viewer.id, isAdmin: viewer.isAdmin, hasPremium: viewer.hasPremium });
  if (!data) notFound();
  const { lesson, progress, prev, next, courseLessons, blocker, canWatch } = data;
  const heading = [lesson.categoryName, `${lesson.number}-dars`].filter(Boolean).join(" — ");

  if (!canWatch) {
    // PRO lesson, viewer without PRO: say which lesson it is, never send any video link.
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link href="/lessons" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> Barcha darslar
        </Link>
        <p className="mt-6 font-mono text-[11px] tracking-[0.16em] text-gold-soft uppercase" data-testid="lesson-heading">
          {heading}
        </p>
        <h1 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">{lesson.title}</h1>
        <div className="mt-8" data-testid="lesson-pro-locked">
          <ProAccessGate />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <Link href="/lessons" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Barcha darslar
      </Link>

      <div className="mt-3 grid grid-cols-1 gap-8 sm:mt-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          {blocker ? (
            <div
              className="-mx-4 grid aspect-video place-items-center border-y border-border-strong bg-surface p-6 text-center sm:mx-0 sm:rounded-2xl sm:border"
              data-testid="lesson-locked"
            >
              <div className="max-w-md">
                <span className="mx-auto grid size-12 place-items-center rounded-full border border-border bg-card-elevated">
                  <LockIcon className="size-5 text-gold-soft" />
                </span>
                <p className="mt-4 font-display text-lg font-bold">Bu dars hali yopiq</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Darslar ketma-ket ochiladi. Avval «{blocker.title}» darsini yakunlang — shundan so‘ng bu dars ochiladi.
                </p>
                <Button asChild className="mt-5">
                  <Link href={`/lessons/${blocker.slug}`} data-testid="go-to-blocker">
                    <PlayIcon /> Shu darsga o‘tish
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <LessonPlayer
              lessonId={lesson.id}
              source={lesson.videoSource}
              embedUrl={lesson.embedUrl}
              posterUrl={lesson.posterUrl}
              hasVideo={lesson.hasVideo}
              initialPosition={progress?.positionSeconds ?? 0}
              initialCompleted={progress?.completed ?? false}
              watermark={viewer.email}
              title={lesson.title}
            />
          )}

          <div className="mt-8">
            <p className="font-mono text-xs tracking-[0.16em] text-gold-soft uppercase" data-testid="lesson-heading">
              {heading}
            </p>
            <h1 className="mt-1.5 font-display text-2xl font-extrabold sm:text-3xl">{lesson.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{lesson.course.title}</Badge>
              {lesson.isFree ? <Badge variant="success">Bepul dars</Badge> : <Badge>PRO</Badge>}
              {lesson.level && <Badge variant="outline">{LEVEL_LABELS[lesson.level]}</Badge>}
              {!lesson.isPublished && <Badge variant="warning">Nashr qilinmagan (admin ko‘rinishi)</Badge>}
              <span className="font-mono text-xs text-muted-foreground">{formatDuration(lesson.durationSeconds)}</span>
            </div>
            {lesson.description && <p className="mt-4 max-w-3xl text-[15.5px] leading-relaxed whitespace-pre-line text-muted-foreground">{lesson.description}</p>}
          </div>

          <nav aria-label="Darslar navigatsiyasi" className="mt-10 grid grid-cols-1 gap-3 border-t border-border pt-6 sm:grid-cols-2">
            {prev ? (
              <Button asChild variant="secondary" className="h-auto justify-start py-3 text-left">
                <Link href={`/lessons/${prev.slug}`} data-testid="prev-lesson">
                  <ArrowLeftIcon />
                  <span className="min-w-0">
                    <span className="block text-xs font-normal text-muted-foreground">Oldingi dars</span>
                    <span className="block truncate">{prev.title}</span>
                  </span>
                </Link>
              </Button>
            ) : (
              <span />
            )}
            {next && (
              <Button asChild variant="secondary" className="h-auto justify-end py-3 text-right">
                <Link href={`/lessons/${next.slug}`} data-testid="next-lesson">
                  <span className="min-w-0">
                    <span className="block text-xs font-normal text-muted-foreground">
                      {!next.locked ? "Keyingi dars" : viewer.hasPremium || next.isFree ? "Keyingi dars · bu darsni yakunlagach ochiladi" : "Keyingi dars · PRO"}
                    </span>
                    <span className="block truncate">{next.title}</span>
                  </span>
                  {next.locked ? <LockIcon /> : <ArrowRightIcon />}
                </Link>
              </Button>
            )}
          </nav>
        </div>

        <aside aria-label="Kurs darslari" className="lg:sticky lg:top-24 lg:self-start">
          <div className="card-surface overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">Kurs</p>
              <p className="mt-1 font-display font-bold">{lesson.course.title}</p>
            </div>
            <ol className="max-h-[60vh] overflow-y-auto p-2">
              {courseLessons.map((l) => {
                const active = l.slug === lesson.slug;
                return (
                  <li key={l.id}>
                    <Link
                      href={`/lessons/${l.slug}`}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                        active ? "bg-card-elevated text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                        l.locked && !active && "opacity-60",
                      )}
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-border font-mono text-xs">
                        {l.completed ? (
                          <CheckCircle2Icon className="size-4 text-success" />
                        ) : active ? (
                          <PlayIcon className="size-3.5 text-gold-soft" />
                        ) : l.locked ? (
                          <LockIcon className="size-3.5" aria-label="Yopiq" />
                        ) : (
                          l.order
                        )}
                      </span>
                      <span className="line-clamp-2 flex-1">{l.title}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{formatDuration(l.durationSeconds)}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
