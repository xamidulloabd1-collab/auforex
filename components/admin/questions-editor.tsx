"use client";

import * as React from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import type { z } from "zod";
import { saveQuestions } from "@/lib/actions/admin/challenges";
import { questionsSchema } from "@/lib/validations/admin";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "./action-controls";

type Values = z.input<typeof questionsSchema>;

export function QuestionsEditor({ challengeId, initial, locked }: { challengeId: string; initial: Values["questions"]; locked: boolean }) {
  const { pending, run } = useAction();
  const form = useForm<Values>({ resolver: zodResolver(questionsSchema), defaultValues: { questions: initial } });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "questions" });
  const errors = form.formState.errors.questions;

  return (
    <form onSubmit={form.handleSubmit((v) => run(() => saveQuestions(challengeId, v)))} className="grid gap-4" data-testid="questions-editor">
      {locked && <p className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-amber-200">Topshiriqlar mavjud — adolatli baholash uchun savollar qulflangan.</p>}
      {fields.map((f, qi) => {
        const options = form.watch(`questions.${qi}.options`) ?? [];
        const correct = Number(form.watch(`questions.${qi}.correctIndex`));
        const qErr = errors?.[qi];
        return (
          <fieldset key={f.id} disabled={locked} className="card-surface grid gap-3 p-5">
            <div className="flex items-center justify-between">
              <legend className="font-mono text-xs text-gold-soft">{qi + 1}-savol</legend>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Ball
                  <Input type="number" min={1} className="h-8 w-16" {...form.register(`questions.${qi}.points`)} />
                </label>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Savolni o‘chirish" onClick={() => remove(qi)}>
                  <Trash2Icon />
                </Button>
              </div>
            </div>
            <Textarea rows={2} placeholder="Savol matni" {...form.register(`questions.${qi}.prompt`)} />
            {qErr?.prompt && <p className="text-xs text-red-300">{qErr.prompt.message}</p>}
            <div className="grid gap-2">
              {options.map((_, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input
                    type="radio"
                    aria-label={`${oi + 1}-variant to‘g‘ri`}
                    checked={correct === oi}
                    onChange={() => form.setValue(`questions.${qi}.correctIndex`, oi)}
                    className="size-4 accent-[var(--success)]"
                  />
                  <Input className={cn("h-9", correct === oi && "border-success/60")} placeholder={`${oi + 1}-variant`} {...form.register(`questions.${qi}.options.${oi}`)} />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Variantni o‘chirish"
                      onClick={() => {
                        form.setValue(`questions.${qi}.options`, options.filter((__, j) => j !== oi));
                        if (correct >= oi && correct > 0) form.setValue(`questions.${qi}.correctIndex`, correct - 1);
                      }}
                    >
                      <Trash2Icon />
                    </Button>
                  )}
                </div>
              ))}
              {options.length < 6 && (
                <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => form.setValue(`questions.${qi}.options`, [...options, ""])}>
                  <PlusIcon /> Variant
                </Button>
              )}
              {(qErr?.options || qErr?.correctIndex) && <p className="text-xs text-red-300">{qErr?.options?.message ?? qErr?.options?.[0]?.message ?? qErr?.correctIndex?.message}</p>}
            </div>
            <Input placeholder="Izoh (ixtiyoriy, faqat adminlar ko‘radi)" {...form.register(`questions.${qi}.explanation`)} />
          </fieldset>
        );
      })}
      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="outline" disabled={locked} onClick={() => append({ prompt: "", options: ["", ""], correctIndex: 0, explanation: "", points: 1 })} data-testid="add-question">
          <PlusIcon /> Savol qo‘shish
        </Button>
        <Button type="submit" disabled={pending || locked} data-testid="save-questions">
          {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Savollarni saqlash
        </Button>
      </div>
    </form>
  );
}
