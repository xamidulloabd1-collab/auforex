import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, AwardIcon, CalendarClockIcon, CheckIcon, GiftIcon, ListChecksIcon, TargetIcon, UsersIcon } from "lucide-react";
import { getViewer } from "@/lib/auth/session";
import { getChallengeDetail } from "@/lib/data/challenges";
import { CHALLENGE_TYPE_LABELS, OUTCOME_LABELS, SUBMISSION_STATUS_LABELS } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { RiskDisclaimer } from "@/components/shared/risk-disclaimer";
import { ProAccessGate } from "@/components/subscription/pro-access-gate";
import { PhaseBadge } from "@/components/challenge/challenge-card";
import { QuizForm, SubmissionForm } from "@/components/challenge/participation";

export const metadata: Metadata = { title: "Challenge", robots: { index: false } };

export default async function ChallengeDetailPage({ params }: PageProps<"/challenge/[slug]">) {
  const { slug } = await params;
  const viewer = await getViewer();
  const canParticipate = Boolean(viewer?.hasPremium);
  const data = await getChallengeDetail(slug, { viewerId: viewer?.id ?? null, isAdmin: Boolean(viewer?.isAdmin), canParticipate });
  if (!data) notFound();
  const { challenge, phase, rewards, questions, submission, myResult, leaderboard } = data;

  const isQuiz = challenge.type === "QUIZ";
  const locked = submission && (submission.status !== "PENDING" || isQuiz);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <Link href="/challenge" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Barcha challenge’lar
      </Link>

      <header className="mt-6 flex flex-col gap-4 border-b border-border pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <PhaseBadge phase={phase} />
          <Badge variant="outline">{CHALLENGE_TYPE_LABELS[challenge.type]}</Badge>
          {challenge.status === "DRAFT" && <Badge variant="warning">Qoralama (admin ko‘rinishi)</Badge>}
        </div>
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{challenge.title}</h1>
        <p className="max-w-3xl text-lg text-muted-foreground">{challenge.summary}</p>
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CalendarClockIcon className="size-4" />
            <dt className="sr-only">Muddat</dt>
            <dd>
              {formatDateTime(challenge.startsAt)} — {formatDateTime(challenge.endsAt)}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <UsersIcon className="size-4" />
            <dt className="sr-only">Ishtirokchilar</dt>
            <dd>{challenge.participants} ishtirokchi</dd>
          </div>
          <div className="flex items-center gap-2">
            <AwardIcon className="size-4" />
            <dt className="sr-only">Ball</dt>
            <dd>
              Maksimal ball: {challenge.maxScore}
              {challenge.passingScore != null ? ` · o‘tish bali: ${challenge.passingScore}` : ""}
            </dd>
          </div>
        </dl>
      </header>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="desc-title">
            <h2 id="desc-title" className="sr-only">
              Tavsif
            </h2>
            <p className="text-[15.5px] leading-[1.8] whitespace-pre-line text-muted-foreground">{challenge.description}</p>
          </section>

          {(challenge.objectives.length > 0 || challenge.requirements.length > 0) && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {challenge.objectives.length > 0 && (
                <section className="card-surface p-6" aria-labelledby="obj-title">
                  <h2 id="obj-title" className="flex items-center gap-2 font-display font-bold">
                    <TargetIcon className="size-4 text-gold-soft" /> Ta’limiy maqsadlar
                  </h2>
                  <ul className="mt-4 grid gap-2.5 text-sm text-muted-foreground">
                    {challenge.objectives.map((o) => (
                      <li key={o} className="flex gap-2">
                        <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" /> {o}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {challenge.requirements.length > 0 && (
                <section className="card-surface p-6" aria-labelledby="req-title">
                  <h2 id="req-title" className="flex items-center gap-2 font-display font-bold">
                    <ListChecksIcon className="size-4 text-gold-soft" /> Qatnashish shartlari
                  </h2>
                  <ul className="mt-4 grid gap-2.5 text-sm text-muted-foreground">
                    {challenge.requirements.map((r) => (
                      <li key={r} className="flex gap-2">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden /> {r}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          <section aria-labelledby="participate-title">
            <h2 id="participate-title" className="font-display text-2xl font-bold">
              Ishtirok
            </h2>
            <div className="mt-5">
              {!canParticipate ? (
                <ProAccessGate isGuest={!viewer} />
              ) : submission && locked ? (
                <div className="card-surface p-6" data-testid="submission-status">
                  <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">Topshirig‘ingiz</p>
                  <p className="mt-2 font-display text-xl font-bold">{SUBMISSION_STATUS_LABELS[submission.status]}</p>
                  {submission.score != null && (
                    <p className="mt-2 text-muted-foreground">
                      Ball: <span className="font-mono text-foreground">{submission.score}</span> / {challenge.maxScore}
                    </p>
                  )}
                  {submission.feedback && (
                    <blockquote className="mt-4 rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                      <span className="mb-1 block font-semibold text-foreground">Admin izohi</span>
                      {submission.feedback}
                    </blockquote>
                  )}
                  <p className="mt-4 text-xs text-muted-foreground">Yuborilgan: {formatDateTime(submission.submittedAt)}</p>
                </div>
              ) : phase === "OPEN" ? (
                isQuiz ? (
                  questions.length > 0 ? (
                    <QuizForm challengeId={challenge.id} questions={questions} />
                  ) : (
                    <p className="text-muted-foreground">Test savollari hali qo‘shilmagan.</p>
                  )
                ) : (
                  <>
                    {submission && (
                      <p className="mb-4 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
                        Topshirig‘ingiz yuborilgan va ko‘rib chiqilishini kutmoqda. Muddat tugaguncha uni yangilashingiz mumkin.
                      </p>
                    )}
                    <SubmissionForm
                      challengeId={challenge.id}
                      allowAttachment={challenge.allowAttachment}
                      initial={submission ? { content: submission.content ?? "", linkUrl: submission.linkUrl ?? "", hasAttachment: submission.hasAttachment } : null}
                    />
                  </>
                )
              ) : (
                <p className="card-surface p-6 text-muted-foreground">
                  {phase === "UPCOMING"
                    ? `Topshiriqlar ${formatDateTime(challenge.startsAt)} dan qabul qilinadi.`
                    : submission
                      ? `Topshiriq holati: ${SUBMISSION_STATUS_LABELS[submission.status]}.`
                      : "Topshiriq qabul qilish yakunlangan."}
                </p>
              )}
            </div>
          </section>

          {phase === "RESULTS" && (
            <section aria-labelledby="results-title">
              <h2 id="results-title" className="font-display text-2xl font-bold">
                Natijalar
              </h2>
              {myResult && (
                <p className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 px-5 py-4 text-sm">
                  Sizning natijangiz: <strong>{myResult.rank}-o‘rin</strong> · {myResult.score} ball · {OUTCOME_LABELS[myResult.outcome]}
                  {myResult.reward ? ` · Mukofot: ${myResult.reward.title}` : ""}
                </p>
              )}
              {leaderboard.length > 0 ? (
                <ol className="mt-5 overflow-hidden rounded-2xl border border-border" data-testid="leaderboard">
                  {leaderboard.map((r) => (
                    <li key={`${r.rank}-${r.name}`} className={cn("flex items-center gap-4 border-b border-border bg-card px-5 py-3 last:border-0", r.isMe && "bg-primary/10")}>
                      <span className={cn("w-8 font-mono font-semibold", r.rank <= 3 ? "text-gold-soft" : "text-muted-foreground")}>{r.rank}</span>
                      <span className="flex-1 font-medium">
                        {r.name}
                        {r.isMe && <span className="ml-2 text-xs text-gold-soft">(siz)</span>}
                      </span>
                      <Badge variant={r.outcome === "WINNER" ? "default" : r.outcome === "PASSED" ? "success" : "secondary"}>{OUTCOME_LABELS[r.outcome]}</Badge>
                      <span className="w-16 text-right font-mono">{r.score}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Reyting jadvali ko‘rsatilmaydi.</p>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <section className="card-surface p-6" aria-labelledby="rewards-title">
            <h2 id="rewards-title" className="flex items-center gap-2 font-display font-bold">
              <GiftIcon className="size-4 text-gold-soft" /> Mukofotlar
            </h2>
            {rewards.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Bu challenge uchun mukofot e’lon qilinmagan.</p>
            ) : (
              <ul className="mt-4 grid gap-3" data-testid="rewards">
                {rewards.map((r) => (
                  <li key={r.id} className="rounded-xl border border-border bg-surface p-4">
                    <p className="font-semibold">{r.title}</p>
                    {r.rankFrom != null && (
                      <p className="mt-1 font-mono text-xs text-gold-soft">
                        {r.rankFrom === r.rankTo || r.rankTo == null ? `${r.rankFrom}-o‘rin` : `${r.rankFrom}–${r.rankTo}-o‘rinlar`}
                      </p>
                    )}
                    {r.description && <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>}
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      <span className="font-semibold text-foreground/80">Shartlar:</span> {r.eligibility}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Mukofotlar faqat e’lon qilingan shartlar asosida beriladi va kafolatlanmaydi.</p>
          </section>
          <RiskDisclaimer>Challenge ta’limiy faoliyat. Real pul kiritish, real hisobda savdo yoki leveraj talab qilinmaydi.</RiskDisclaimer>
        </aside>
      </div>
    </div>
  );
}
