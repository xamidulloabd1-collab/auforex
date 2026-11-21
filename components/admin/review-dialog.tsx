"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";
import { reviewSubmission } from "@/lib/actions/admin/challenges";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "./action-controls";

export function ReviewDialog({
  submissionId,
  maxScore,
  initial,
  disabled,
}: {
  submissionId: string;
  maxScore: number;
  initial: { score: number | null; feedback: string | null };
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [score, setScore] = React.useState(initial.score == null ? "" : String(initial.score));
  const [feedback, setFeedback] = React.useState(initial.feedback ?? "");
  const { pending, run } = useAction();

  const submit = (status: "REVIEWED" | "REJECTED") =>
    run(() => reviewSubmission(submissionId, { status, score: score === "" ? null : Number(score), feedback }), { onSuccess: () => setOpen(false) });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" disabled={disabled} data-testid="review-button">
          Baholash
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Topshiriqni baholash</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`score-${submissionId}`}>Ball (0–{maxScore})</Label>
            <Input id={`score-${submissionId}`} type="number" min={0} max={maxScore} value={score} onChange={(e) => setScore(e.target.value)} data-testid="review-score" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`fb-${submissionId}`}>Izoh (foydalanuvchi ko‘radi)</Label>
            <Textarea id={`fb-${submissionId}`} rows={4} value={feedback} maxLength={2000} onChange={(e) => setFeedback(e.target.value)} />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="destructive" disabled={pending} onClick={() => submit("REJECTED")}>
              Qabul qilinmadi
            </Button>
            <Button disabled={pending || score === ""} onClick={() => submit("REVIEWED")} data-testid="review-save">
              {pending && <Loader2Icon className="animate-spin" />} Bahoni saqlash
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
