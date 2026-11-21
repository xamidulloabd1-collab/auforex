"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { saveChallenge } from "@/lib/actions/admin/challenges";
import { CHALLENGE_TYPE_LABELS } from "@/lib/constants";
import { challengeSchema } from "@/lib/validations/admin";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ListEditor } from "./list-editor";

type Values = z.input<typeof challengeSchema>;

export function ChallengeForm({ challenge, lockType }: { challenge?: Values & { id: string }; lockType?: boolean }) {
  const router = useRouter();
  const form = useForm<Values>({
    resolver: zodResolver(challengeSchema),
    defaultValues: challenge ?? {
      title: "",
      slug: "",
      summary: "",
      description: "",
      type: "QUIZ",
      objectives: [],
      requirements: [],
      startsAt: "",
      endsAt: "",
      maxScore: 100,
      passingScore: null,
      allowAttachment: false,
      showLeaderboard: true,
    },
  });

  async function onSubmit(values: Values) {
    const res = await saveChallenge(challenge?.id ?? null, {
      ...values,
      objectives: values.objectives.filter((s) => s.trim()),
      requirements: values.requirements.filter((s) => s.trim()),
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Saqlandi");
    if (!challenge && res.data) router.push(`/super-admin/challenges/${res.data.id}`);
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="card-surface grid gap-5 p-6" data-testid="challenge-form">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_240px]">
          <FormField control={form.control} name="title" render={({ field }) => (
            <FormItem><FormLabel>Sarlavha</FormLabel><FormControl><Input {...field} data-testid="challenge-title" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="type" render={({ field }) => (
            <FormItem><FormLabel>Turi</FormLabel><FormControl>
              <NativeSelect {...field} disabled={lockType} data-testid="challenge-type">
                {Object.entries(CHALLENGE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </NativeSelect>
            </FormControl>{lockType && <FormDescription>Topshiriqlar bor — tur o‘zgarmaydi.</FormDescription>}<FormMessage /></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="summary" render={({ field }) => (
          <FormItem><FormLabel>Qisqa tavsif</FormLabel><FormControl><Input {...field} maxLength={300} data-testid="challenge-summary" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem><FormLabel>To‘liq tavsif va qoidalar</FormLabel><FormControl><Textarea rows={7} {...field} data-testid="challenge-description" /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="grid gap-2">
            <p className="text-sm font-medium">Ta’limiy maqsadlar</p>
            <Controller control={form.control} name="objectives" render={({ field }) => <ListEditor value={field.value} onChange={field.onChange} placeholder="Masalan: trendni aniqlash" />} />
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium">Qatnashish shartlari</p>
            <Controller control={form.control} name="requirements" render={({ field }) => <ListEditor value={field.value} onChange={field.onChange} placeholder="Masalan: faqat demo hisob" />} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <FormField control={form.control} name="startsAt" render={({ field }) => (
            <FormItem><FormLabel>Boshlanish (Toshkent)</FormLabel><FormControl><Input type="datetime-local" {...field} data-testid="challenge-start" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="endsAt" render={({ field }) => (
            <FormItem><FormLabel>Tugash (Toshkent)</FormLabel><FormControl><Input type="datetime-local" {...field} data-testid="challenge-end" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="maxScore" render={({ field }) => (
            <FormItem><FormLabel>Maksimal ball</FormLabel><FormControl><Input type="number" min={1} {...field} value={String(field.value ?? "")} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="passingScore" render={({ field }) => (
            <FormItem><FormLabel>O‘tish bali</FormLabel><FormControl>
              <Input type="number" min={0} value={field.value == null ? "" : String(field.value)} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} placeholder="ixtiyoriy" />
            </FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField control={form.control} name="allowAttachment" render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
              <FormLabel>Rasm biriktirishga ruxsat</FormLabel>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="showLeaderboard" render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
              <FormLabel>Natijalarda reyting jadvali</FormLabel>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            </FormItem>
          )} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting} data-testid="challenge-save">
            {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Saqlash
          </Button>
        </div>
      </form>
    </Form>
  );
}
