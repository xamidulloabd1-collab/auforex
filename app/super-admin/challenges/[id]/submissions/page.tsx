import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon, ImageIcon } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { SUBMISSION_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AdminTitle } from "@/components/admin/admin-title";
import { ReviewDialog } from "@/components/admin/review-dialog";

export default async function SubmissionsPage({ params }: PageProps<"/super-admin/challenges/[id]/submissions">) {
  await requireAdmin();
  const { id } = await params;
  const challenge = await prisma.challenge.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      maxScore: true,
      questions: { select: { id: true } },
      submissions: {
        orderBy: [{ status: "asc" }, { submittedAt: "asc" }],
        select: {
          id: true,
          content: true,
          linkUrl: true,
          attachmentKey: true,
          autoScore: true,
          status: true,
          score: true,
          feedback: true,
          submittedAt: true,
          reviewedAt: true,
          user: { select: { name: true, email: true } },
          result: { select: { rank: true } },
        },
      },
    },
  });
  if (!challenge) notFound();
  const locked = challenge.status === "RESULTS_PUBLISHED";

  return (
    <>
      <Link href={`/super-admin/challenges/${challenge.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> {challenge.title}
      </Link>
      <AdminTitle title="Topshiriqlar" description={`${challenge.submissions.length} ta topshiriq${locked ? " · natijalar e’lon qilingan" : ""}`} />
      {challenge.submissions.length === 0 ? (
        <p className="text-muted-foreground">Hali topshiriq yo‘q.</p>
      ) : (
        <ul className="grid gap-4">
          {challenge.submissions.map((s) => (
            <li key={s.id} className="card-surface p-5" data-testid="submission-item">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.user.email} · {formatDateTime(s.submittedAt)}
                  </p>
                </div>
                <Badge variant={s.status === "PENDING" ? "warning" : s.status === "REVIEWED" ? "success" : "destructive"}>{SUBMISSION_STATUS_LABELS[s.status]}</Badge>
                {s.score != null && (
                  <span className="font-mono text-sm">
                    {s.score}/{challenge.maxScore}
                  </span>
                )}
                {s.result && <Badge>{s.result.rank}-o‘rin</Badge>}
                <ReviewDialog submissionId={s.id} maxScore={challenge.maxScore} initial={{ score: s.score, feedback: s.feedback }} disabled={locked} />
              </div>
              {challenge.type === "QUIZ" ? (
                <p className="mt-3 text-sm text-muted-foreground">Avtomatik baho: {s.autoScore ?? "—"} / {challenge.maxScore} ({challenge.questions.length} savol)</p>
              ) : (
                <div className="mt-4 grid gap-3">
                  {s.content && <p className="rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed whitespace-pre-line">{s.content}</p>}
                  <div className="flex flex-wrap gap-4 text-sm">
                    {s.linkUrl && (
                      <a href={s.linkUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 text-gold-soft hover:underline">
                        Havola <ExternalLinkIcon className="size-3.5" />
                      </a>
                    )}
                    {s.attachmentKey && (
                      <a href={`/api/challenges/submissions/${s.id}/attachment`} target="_blank" className="inline-flex items-center gap-1.5 text-gold-soft hover:underline">
                        <ImageIcon className="size-4" /> Biriktirilgan rasm
                      </a>
                    )}
                  </div>
                </div>
              )}
              {s.feedback && <p className="mt-3 text-xs text-muted-foreground">Izoh: {s.feedback}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
