import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircle2Icon, PlayIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getLessonForViewer } from "@/lib/data/learning";
import { cn, formatDuration } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProAccessGate } from "@/components/subscription/pro-access-gate";
import { LessonPlayer } from "@/components/lessons/lesson-player";

export const metadata: Metadata = { title: "Dars", robots: { index: false } };

export default async function LessonPage({ params }: PageProps<"/lessons/[slug]">) {
  const { slug } = await params;
  const viewer = await requireUser(`/lessons/${slug}`);
  if (!viewer.hasPremium) {
    return (
      <div className="px-4 py-16 sm:px-6">
        <ProAccessGate />
      </div>
    );
  }

  const data = await getLessonForViewer(slug, { userId: viewer.id, isAdmin: viewer.isAdmin });
  if (!data) notFound();
  const { lesson, progress, prev, next, courseLessons } = data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <Link href="/lessons" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Barcha darslar
      </Link>

      <div className="mt-3 grid grid-cols-1 gap-8 sm:mt-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
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

          <div className="mt-8">
            <div className="flex flex-wrap items-center gap-2">
              {lesson.course.categoryName && <Badge>{lesson.course.categoryName}</Badge>}
              <Badge variant="secondary">{lesson.course.title}</Badge>
              {!lesson.isPublished && <Badge variant="warning">Nashr qilinmagan (admin ko‘rinishi)</Badge>}
              <span className="font-mono text-xs text-muted-foreground">
                {data.position}/{data.total} · {formatDuration(lesson.durationSeconds)}
              </span>
            </div>
            <h1 className="mt-4 font-display text-2xl font-extrabold sm:text-3xl">{lesson.title}</h1>
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
                    <span className="block text-xs font-normal text-muted-foreground">Keyingi dars</span>
                    <span className="block truncate">{next.title}</span>
                  </span>
                  <ArrowRightIcon />
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
              {courseLessons.map((l, i) => {
                const active = l.slug === lesson.slug;
                return (
                  <li key={l.id}>
                    <Link
                      href={`/lessons/${l.slug}`}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                        active ? "bg-card-elevated text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-border font-mono text-xs">
                        {l.completed ? <CheckCircle2Icon className="size-4 text-success" /> : active ? <PlayIcon className="size-3.5 text-gold-soft" /> : i + 1}
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
