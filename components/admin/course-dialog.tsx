"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PencilIcon, PlusIcon } from "lucide-react";
import type { z } from "zod";
import { saveCourse } from "@/lib/actions/admin/content";
import { courseSchema } from "@/lib/validations/admin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "./action-controls";

type Values = z.input<typeof courseSchema>;

export function CourseDialog({
  course,
  categories,
}: {
  course?: { id: string; title: string; slug: string; description: string | null; categoryId: string | null; order: number; isPublished: boolean };
  categories: { id: string; name: string }[];
}) {
  const [open, setOpen] = React.useState(false);
  const { pending, run } = useAction();
  const form = useForm<Values>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: course?.title ?? "",
      slug: course?.slug ?? "",
      description: course?.description ?? "",
      categoryId: course?.categoryId ?? "",
      order: course?.order ?? 0,
      isPublished: course?.isPublished ?? false,
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {course ? (
          <Button variant="ghost" size="icon-sm" aria-label="Tahrirlash">
            <PencilIcon />
          </Button>
        ) : (
          <Button data-testid="new-course">
            <PlusIcon /> Yangi kurs
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{course ? "Kursni tahrirlash" : "Yangi kurs"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => run(() => saveCourse(course?.id ?? null, v), { onSuccess: () => setOpen(false) }))}
          >
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem><FormLabel>Sarlavha</FormLabel><FormControl><Input {...field} data-testid="course-title" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="slug" render={({ field }) => (
              <FormItem><FormLabel>Slug (URL)</FormLabel><FormControl><Input {...field} placeholder="avtomatik" /></FormControl><FormDescription>Bo‘sh qoldirilsa sarlavhadan yaratiladi.</FormDescription><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Tavsif</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="categoryId" render={({ field }) => (
                <FormItem><FormLabel>Kategoriya</FormLabel><FormControl>
                  <NativeSelect {...field}>
                    <option value="">Kategoriyasiz</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </NativeSelect>
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="order" render={({ field }) => (
                <FormItem><FormLabel>Tartib raqami</FormLabel><FormControl><Input type="number" min={0} {...field} value={String(field.value ?? 0)} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="isPublished" render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
                <FormLabel>Nashr qilingan</FormLabel>
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
