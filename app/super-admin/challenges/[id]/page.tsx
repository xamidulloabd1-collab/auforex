import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon, Trash2Icon } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { deleteChallenge, deleteReward, publishResults, setChallengeStatus } from "@/lib/actions/admin/challenges";
import { CHALLENGE_STATUS_LABELS } from "@/lib/constants";
import { toDateTimeLocalValue } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminTitle } from "@/components/admin/admin-title";
import { ConfirmAction } from "@/components/admin/action-controls";
import { ChallengeForm } from "@/components/admin/challenge-form";
import { QuestionsEditor } from "@/components/admin/questions-editor";
import { RewardDialog } from "@/components/admin/reward-dialog";

export default async function EditChallengePage({ params }: PageProps<"/super-admin/challenges/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const c = await prisma.challenge.findUnique({
    where: { id },
    include: {
      questions: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      rewards: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      _count: { select: { submissions: true } },
    },
  });
  if (!c) notFound();
  const pending = await prisma.challengeSubmission.count({ where: { challengeId: id, status: "PENDING" } });
  const hasSubs = c._count.submissions > 0;

  return (
    <>
      <Link href="/super-admin/challenges" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Challenge’lar
      </Link>
      <AdminTitle
        title={c.title}
        description={
          <span className="inline-flex items-center gap-2">
            <Badge variant={c.status === "PUBLISHED" ? "success" : "secondary"} data-testid="challenge-status">
              {CHALLENGE_STATUS_LABELS[c.status]}
            </Badge>
            {c._count.submissions} ta topshiriq{pending ? ` · ${pending} ta baholanmagan` : ""}
          </span>
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/challenge/${c.slug}`} target="_blank">
                Ko‘rish <ExternalLinkIcon />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/super-admin/challenges/${c.id}/submissions`}>Topshiriqlar</Link>
            </Button>
            {c.status === "DRAFT" && (
              <ConfirmAction action={async () => { "use server"; return setChallengeStatus(c.id, "PUBLISHED"); }} title="Challenge e’lon qilinsinmi?" description="PRO foydalanuvchilar uni ko‘radi va muddat ichida qatnasha oladi." confirmLabel="E’lon qilish" destructive={false} variant="default" testId="publish-challenge">
                E’lon qilish
              </ConfirmAction>
            )}
            {c.status === "PUBLISHED" && (
              <ConfirmAction action={async () => { "use server"; return setChallengeStatus(c.id, "CLOSED"); }} title="Challenge yopilsinmi?" description="Yangi topshiriqlar qabul qilinmaydi." confirmLabel="Yopish">
                Yopish
              </ConfirmAction>
            )}
            {(c.status === "PUBLISHED" || c.status === "CLOSED") && (
              <ConfirmAction action={async () => { "use server"; return publishResults(c.id); }} title="Natijalar e’lon qilinsinmi?" description="Baholangan topshiriqlar reytingga joylanadi, e’lon qilingan mukofotlar o‘rinlarga biriktiriladi. Keyin baholarni o‘zgartirib bo‘lmaydi." confirmLabel="E’lon qilish" destructive={false} variant="default" testId="publish-results">
                Natijalarni e’lon qilish
              </ConfirmAction>
            )}
            {!hasSubs && (
              <ConfirmAction action={async () => { "use server"; return deleteChallenge(c.id); }} title="Challenge o‘chirilsinmi?" confirmLabel="O‘chirish" variant="ghost" redirectTo="/super-admin/challenges">
                <Trash2Icon /> O‘chirish
              </ConfirmAction>
            )}
          </>
        }
      />

      <div className="grid gap-10">
        <ChallengeForm
          lockType={hasSubs}
          challenge={{
            id: c.id,
            title: c.title,
            slug: c.slug,
            summary: c.summary,
            description: c.description,
            type: c.type,
            objectives: c.objectives,
            requirements: c.requirements,
            startsAt: toDateTimeLocalValue(c.startsAt),
            endsAt: toDateTimeLocalValue(c.endsAt),
            maxScore: c.maxScore,
            passingScore: c.passingScore,
            allowAttachment: c.allowAttachment,
            showLeaderboard: c.showLeaderboard,
          }}
        />

        {c.type === "QUIZ" && (
          <section aria-labelledby="questions-title">
            <h2 id="questions-title" className="mb-4 font-display text-xl font-bold">
              Test savollari ({c.questions.length})
            </h2>
            <QuestionsEditor
              challengeId={c.id}
              locked={hasSubs}
              initial={c.questions.map((q) => ({ prompt: q.prompt, options: q.options, correctIndex: q.correctIndex, explanation: q.explanation ?? "", points: q.points }))}
            />
          </section>
        )}

        <section aria-labelledby="rewards-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="rewards-title" className="font-display text-xl font-bold">
              Mukofotlar
            </h2>
            <RewardDialog challengeId={c.id} />
          </div>
          {c.rewards.length === 0 ? (
            <p className="text-sm text-muted-foreground">Mukofot qo‘shilmagan. Foydalanuvchilarga faqat e’lon qilingan mukofotlar ko‘rinadi.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {c.rewards.map((r) => (
                <li key={r.id} className="card-surface p-4">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{r.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{r.rankFrom != null ? `${r.rankFrom}${r.rankTo && r.rankTo !== r.rankFrom ? `–${r.rankTo}` : ""}-o‘rin` : "O‘ringa bog‘lanmagan"}</p>
                    </div>
                    <Badge variant={r.isPublished ? "success" : "secondary"}>{r.isPublished ? "E’lon qilingan" : "Yashirin"}</Badge>
                    <RewardDialog
                      challengeId={c.id}
                      reward={{ id: r.id, title: r.title, description: r.description ?? "", eligibility: r.eligibility, rankFrom: r.rankFrom, rankTo: r.rankTo, order: r.order, isPublished: r.isPublished }}
                    />
                    <ConfirmAction action={async () => { "use server"; return deleteReward(r.id); }} title="Mukofot o‘chirilsinmi?" confirmLabel="O‘chirish" variant="ghost" size="icon-sm">
                      <Trash2Icon />
                    </ConfirmAction>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{r.eligibility}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
