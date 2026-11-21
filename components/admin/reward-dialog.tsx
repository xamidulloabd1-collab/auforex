"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PencilIcon, PlusIcon } from "lucide-react";
import type { z } from "zod";
import { saveReward } from "@/lib/actions/admin/challenges";
import { rewardSchema } from "@/lib/validations/admin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "./action-controls";

type Values = z.input<typeof rewardSchema>;

const numOrNull = (v: string) => (v === "" ? null : Number(v));

export function RewardDialog({ challengeId, reward }: { challengeId: string; reward?: Values & { id: string } }) {
  const [open, setOpen] = React.useState(false);
  const { pending, run } = useAction();
  const form = useForm<Values>({
    resolver: zodResolver(rewardSchema),
    defaultValues: reward ?? { title: "", description: "", eligibility: "", rankFrom: null, rankTo: null, order: 0, isPublished: false },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {reward ? (
          <Button variant="ghost" size="icon-sm" aria-label="Tahrirlash">
            <PencilIcon />
          </Button>
        ) : (
          <Button variant="outline" size="sm" data-testid="add-reward">
            <PlusIcon /> Mukofot qo‘shish
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{reward ? "Mukofotni tahrirlash" : "Yangi mukofot"}</DialogTitle>
          <DialogDescription>Foydalanuvchilar faqat e’lon qilingan mukofot va shartlarni ko‘radi. Kafolat yoki miqdor va’da qilmang.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={form.handleSubmit((v) => run(() => saveReward(challengeId, reward?.id ?? null, v), { onSuccess: () => setOpen(false) }))}>
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem><FormLabel>Nomi</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Tavsif</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="eligibility" render={({ field }) => (
              <FormItem><FormLabel>Shartlar</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-3 gap-3">
              <FormField control={form.control} name="rankFrom" render={({ field }) => (
                <FormItem><FormLabel>O‘rindan</FormLabel><FormControl><Input type="number" min={1} value={field.value == null ? "" : String(field.value)} onChange={(e) => field.onChange(numOrNull(e.target.value))} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="rankTo" render={({ field }) => (
                <FormItem><FormLabel>O‘ringacha</FormLabel><FormControl><Input type="number" min={1} value={field.value == null ? "" : String(field.value)} onChange={(e) => field.onChange(numOrNull(e.target.value))} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="order" render={({ field }) => (
                <FormItem><FormLabel>Tartib</FormLabel><FormControl><Input type="number" min={0} {...field} value={String(field.value ?? 0)} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="isPublished" render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
                <FormLabel>E’lon qilish</FormLabel>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )} />
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />} Saqlash
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
