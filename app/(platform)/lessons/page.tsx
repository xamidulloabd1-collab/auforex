import type { Metadata } from "next";
import { FilmIcon } from "lucide-react";
import { getViewer } from "@/lib/auth/session";
import { getLessonCatalog } from "@/lib/data/learning";
import { formatTotalDuration } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Progress } from "@/components/ui/progress";
import { ProAccessGate } from "@/components/subscription/pro-access-gate";
import { LessonsBrowser } from "@/components/lessons/lessons-browser";
import { ContinueWatching } from "@/components/lessons/continue-strip";

export const metadata: Metadata = { title: "Video darsliklar", description: "AU Forex Academy video darsliklari: trading asoslaridan amaliy tahlilgacha." };

export default async function LessonsPage() {
  const viewer = await getViewer();

  if (!viewer?.hasPremium) {
    return (
      <>
        <PageHeader eyebrow="Video darsliklar" title="Video darsliklar" description="Tizimli video darslar orqali tradingni bosqichma-bosqich o‘rganing." />
        <div className="px-4 py-16 sm:px-6">
          <ProAccessGate isGuest={!viewer} />
        </div>
      </>
    );
  }

  const catalog = await getLessonCatalog(viewer.id, { isAdmin: viewer.isAdmin });
  const totalSeconds = catalog.lessons.reduce((s, l) => s + (l.durationSeconds ?? 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="Video darsliklar"
        title="Video darsliklar"
        description={catalog.lessons.some((l) => l.locked) ? "Darslar ketma-ket ochiladi: keyingi dars oldingisini yakunlaganingizdan so‘ng ochiladi." : "Kurslar bo‘yicha tartiblangan darslar. O‘rganish jarayoningiz avtomatik saqlanadi."}
        actions={
          catalog.stats.total > 0 ? (
            <div className="card-surface w-full min-w-64 p-4 sm:w-auto" data-testid="learning-progress">
              <div className="flex items-baseline justify-between gap-6">
                <span className="text-sm text-muted-foreground">Umumiy progress</span>
                <span className="font-mono text-2xl font-semibold">{catalog.stats.percent}%</span>
              </div>
              <Progress value={catalog.stats.percent} className="mt-3" />
              <p className="mt-2 text-xs text-muted-foreground">
                {catalog.stats.completed}/{catalog.stats.total} dars yakunlangan{totalSeconds > 0 ? ` · ${formatTotalDuration(totalSeconds)}` : ""}
              </p>
            </div>
          ) : null
        }
      />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {catalog.lessons.length === 0 ? (
          <EmptyState
            icon={<FilmIcon />}
            title="Hozircha video darslar joylanmagan"
            description="Darslar admin tomonidan yuklangach, shu yerda kurslar bo‘yicha paydo bo‘ladi."
          />
        ) : (
          <>
            <ContinueWatching items={catalog.continueWatching} />
            <LessonsBrowser lessons={catalog.lessons} courses={catalog.courses} categories={catalog.categories} />
          </>
        )}
      </div>
    </>
  );
}
