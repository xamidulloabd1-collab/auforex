import type { Metadata } from "next";
import Link from "next/link";
import { TrophyIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyChallenges } from "@/lib/data/dashboard";
import { CHALLENGE_TYPE_LABELS, OUTCOME_LABELS, SUBMISSION_STATUS_LABELS } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AchievementIcon } from "@/components/shared/dynamic-icon";
import { DashTitle } from "@/components/dashboard/stat-card";

export const metadata: Metadata = { title: "Mening challenge’larim", robots: { index: false } };

export default async function MyChallengesPage() {
  const viewer = await requireUser("/dashboard/challenges");
  const data = await getMyChallenges(viewer.id);
  const earned = new Map(data.earned.map((e) => [e.achievement.code, e.awardedAt]));

  return (
    <>
      <DashTitle title="Mening challenge’larim" description="Mavjud, qatnashgan va yakunlangan challenge’lar hamda yutuqlaringiz." />

      <section aria-labelledby="available">
        <h2 id="available" className="font-display text-lg font-bold">
          Mavjud challenge’lar
        </h2>
        {data.available.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Hozir siz qatnashmagan faol challenge yo‘q.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.available.map((c) => (
              <li key={c.id} className="card-surface flex items-center gap-4 p-4">
                <TrophyIcon className="size-5 shrink-0 text-gold-soft" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {CHALLENGE_TYPE_LABELS[c.type]} · {formatDate(c.endsAt)} gacha
                  </p>
                </div>
                <Button asChild size="sm" variant="secondary">
                  <Link href={viewer.hasPremium ? `/challenge/${c.slug}` : "/subscription"}>{viewer.hasPremium ? "Qatnashish" : "PRO"}</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {[
        { id: "participated", title: "Qatnashgan challenge’lar", list: data.participated },
        { id: "completed", title: "Yakunlangan (natijali) challenge’lar", list: data.completed },
      ].map((g) => (
        <section key={g.id} className="mt-10" aria-labelledby={g.id}>
          <h2 id={g.id} className="font-display text-lg font-bold">
            {g.title}
          </h2>
          {g.list.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Hozircha yo‘q.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {g.list.map((s) => (
                <li key={s.id}>
                  <Link href={`/challenge/${s.challenge.slug}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-secondary/40">
                    <span className="min-w-0 flex-1 font-medium">{s.challenge.title}</span>
                    <Badge variant="secondary">{SUBMISSION_STATUS_LABELS[s.status]}</Badge>
                    {s.score != null && (
                      <span className="font-mono text-sm">
                        {s.score}/{s.challenge.maxScore}
                      </span>
                    )}
                    {s.result && (
                      <Badge variant={s.result.outcome === "WINNER" ? "default" : "success"}>
                        {s.result.rank}-o‘rin · {OUTCOME_LABELS[s.result.outcome]}
                      </Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="mt-10" aria-labelledby="achievements">
        <h2 id="achievements" className="font-display text-lg font-bold">
          Yutuqlar
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {data.allAchievements.map((a) => {
            const at = earned.get(a.code);
            return (
              <li
                key={a.code}
                className={cn("card-surface flex flex-col items-start gap-3 p-4", !at && "opacity-45")}
                aria-label={`${a.title}${at ? " — qo‘lga kiritilgan" : " — hali yo‘q"}`}
              >
                <span className={cn("grid size-10 place-items-center rounded-xl border", at ? "border-primary/40 bg-primary/10 text-gold-soft" : "border-border text-muted-foreground")}>
                  <AchievementIcon name={a.icon} className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>
                  {at && <p className="mt-1 font-mono text-[11px] text-gold-soft">{formatDate(at)}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
