import Link from "next/link";
import { CalendarDaysIcon, GiftIcon, UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CHALLENGE_TYPE_LABELS, OUTCOME_LABELS, SUBMISSION_STATUS_LABELS } from "@/lib/constants";
import { PHASE_LABELS, type ChallengePhase } from "@/lib/data/challenges";
import { formatDate } from "@/lib/utils";

export function PhaseBadge({ phase }: { phase: ChallengePhase }) {
  const variant = phase === "OPEN" ? "success" : phase === "UPCOMING" ? "warning" : phase === "RESULTS" ? "default" : "secondary";
  return (
    <Badge variant={variant}>
      {phase === "OPEN" && <span className="size-1.5 animate-pulse-soft rounded-full bg-success" aria-hidden />}
      {PHASE_LABELS[phase]}
    </Badge>
  );
}

type Item = {
  slug: string;
  title: string;
  summary: string;
  type: keyof typeof CHALLENGE_TYPE_LABELS;
  phase: ChallengePhase;
  startsAt: Date;
  endsAt: Date;
  participants: number;
  hasRewards: boolean;
  mySubmission: { status: keyof typeof SUBMISSION_STATUS_LABELS; score: number | null } | null;
  myResult: { rank: number; outcome: keyof typeof OUTCOME_LABELS } | null;
};

export function ChallengeCard({ item, linked = true }: { item: Item; linked?: boolean }) {
  const body = (
    <article className="group card-surface flex h-full flex-col p-6 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-primary/40" data-testid="challenge-card">
      <div className="flex flex-wrap items-center gap-2">
        <PhaseBadge phase={item.phase} />
        <Badge variant="outline">{CHALLENGE_TYPE_LABELS[item.type]}</Badge>
      </div>
      <h3 className="mt-4 font-display text-xl font-bold transition-colors group-hover:text-gold-soft">{item.title}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{item.summary}</p>
      <div className="mt-auto pt-6">
        <dl className="grid gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="size-3.5" />
            <dt className="sr-only">Muddat</dt>
            <dd>
              {formatDate(item.startsAt)} — {formatDate(item.endsAt)}
            </dd>
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <UsersIcon className="size-3.5" /> {item.participants} ishtirokchi
            </span>
            {item.hasRewards && (
              <span className="inline-flex items-center gap-1.5 text-gold-soft">
                <GiftIcon className="size-3.5" /> Mukofotlar e’lon qilingan
              </span>
            )}
          </div>
        </dl>
        {(item.mySubmission || item.myResult) && (
          <p className="mt-4 rounded-xl border border-border bg-surface px-3 py-2 text-xs">
            {item.myResult
              ? `Natijangiz: ${item.myResult.rank}-o‘rin · ${OUTCOME_LABELS[item.myResult.outcome]}`
              : `Topshiriq: ${SUBMISSION_STATUS_LABELS[item.mySubmission!.status]}${item.mySubmission!.score != null ? ` · ${item.mySubmission!.score} ball` : ""}`}
          </p>
        )}
      </div>
    </article>
  );
  return linked ? (
    <Link href={`/challenge/${item.slug}`} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
