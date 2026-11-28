"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImageUpIcon, Loader2Icon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_SINGLE_REQUEST_IMAGE_BYTES as MAX_IMAGE_BYTES } from "@/lib/constants";

async function submit(challengeId: string, data: FormData) {
  const res = await fetch(`/api/challenges/${challengeId}/submission`, { method: "POST", body: data });
  const json = (await res.json().catch(() => ({}))) as { error?: string; score?: number; maxScore?: number; correct?: number; total?: number };
  if (!res.ok) throw new Error(json.error ?? "Topshiriqni yuborib bo‘lmadi");
  return json;
}

export function QuizForm({
  challengeId,
  questions,
}: {
  challengeId: string;
  questions: { id: string; prompt: string; options: string[]; points: number }[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = React.useState<Record<string, number>>({});
  const [pending, setPending] = React.useState(false);
  const answered = Object.keys(answers).length;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (answered < questions.length) {
      toast.error(`Barcha savollarga javob bering (${questions.length - answered} ta qoldi)`);
      return;
    }
    setPending(true);
    try {
      const fd = new FormData();
      fd.set("answers", JSON.stringify(answers));
      const res = await submit(challengeId, fd);
      toast.success(`Test yakunlandi: ${res.score}/${res.maxScore} ball`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6" data-testid="quiz-form">
      {questions.map((q, qi) => (
        <fieldset key={q.id} className="card-surface p-5 sm:p-6">
          <legend className="sr-only">{qi + 1}-savol</legend>
          <p className="font-mono text-xs text-gold-soft">
            {qi + 1}/{questions.length} · {q.points} ball
          </p>
          <p className="mt-2 font-display text-lg font-semibold whitespace-pre-line">{q.prompt}</p>
          <div className="mt-4 grid gap-2">
            {q.options.map((opt, oi) => {
              const checked = answers[q.id] === oi;
              return (
                <label
                  key={oi}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[15px] transition-colors",
                    checked ? "border-primary/60 bg-primary/10" : "border-border bg-surface hover:border-border-strong",
                  )}
                >
                  <input
                    type="radio"
                    name={q.id}
                    value={oi}
                    checked={checked}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                    className="size-4 accent-[var(--primary)]"
                  />
                  {opt}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Javob berildi: <span className="font-mono text-foreground">{answered}</span>/{questions.length}
        </p>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />} Testni yakunlash
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Test bir marta topshiriladi — yuborishdan oldin javoblarni tekshiring.</p>
    </form>
  );
}

export function SubmissionForm({
  challengeId,
  allowAttachment,
  initial,
}: {
  challengeId: string;
  allowAttachment: boolean;
  initial: { content: string; linkUrl: string; hasAttachment: boolean } | null;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const content = String(fd.get("content") ?? "").trim();
    if (content.length < 30) {
      setError("Javob kamida 30 ta belgidan iborat bo‘lsin");
      return;
    }
    const file = fd.get("attachment");
    if (file instanceof File && file.size > MAX_IMAGE_BYTES) {
      setError("Rasm hajmi 4 MB dan oshmasin");
      return;
    }
    setPending(true);
    try {
      await submit(challengeId, fd);
      toast.success(initial ? "Topshiriq yangilandi" : "Topshiriq yuborildi");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card-surface grid gap-5 p-5 sm:p-6" data-testid="submission-form">
      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}
      <div className="grid gap-2">
        <Label htmlFor="content">Javobingiz / tahlilingiz</Label>
        <Textarea id="content" name="content" rows={8} defaultValue={initial?.content ?? ""} placeholder="Tahlilingizni, mulohazalaringizni yoki jurnal yozuvingizni batafsil yozing…" required minLength={30} maxLength={10000} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="linkUrl">Havola (ixtiyoriy)</Label>
        <Input id="linkUrl" name="linkUrl" type="url" inputMode="url" defaultValue={initial?.linkUrl ?? ""} placeholder="https://www.tradingview.com/x/…" />
        <p className="text-xs text-muted-foreground">Masalan, TradingView’dagi tahlilingiz yoki demo-jurnal hujjati havolasi.</p>
      </div>
      {allowAttachment && (
        <div className="grid gap-2">
          <Label htmlFor="attachment">Grafik skrinshoti (PNG, JPG yoki WEBP, 4 MB gacha)</Label>
          <label
            htmlFor="attachment"
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface px-4 py-4 text-sm text-muted-foreground transition hover:border-primary/50"
          >
            <ImageUpIcon className="size-5 text-gold-soft" />
            {fileName ?? (initial?.hasAttachment ? "Rasm biriktirilgan — almashtirish uchun tanlang" : "Rasm tanlash")}
          </label>
          <input id="attachment" name="attachment" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} />
        </div>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />} {initial ? "Topshiriqni yangilash" : "Topshiriqni yuborish"}
        </Button>
      </div>
    </form>
  );
}
