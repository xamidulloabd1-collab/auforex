"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { saveLesson } from "@/lib/actions/admin/content";
import { lessonSchema } from "@/lib/validations/admin";
import { formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { UploadField } from "./upload-field";

type Values = z.input<typeof lessonSchema>;

function readVideoDuration(file: File) {
  return new Promise<number | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const d = Number.isFinite(v.duration) ? Math.round(v.duration) : null;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    v.src = url;
  });
}

export function LessonForm({
  lesson,
  courses,
  defaultCourseId,
  maxVideoBytes,
}: {
  lesson?: Values & { id: string };
  courses: { id: string; title: string }[];
  defaultCourseId?: string;
  maxVideoBytes: number;
}) {
  const router = useRouter();
  const form = useForm<Values>({
    resolver: zodResolver(lessonSchema),
    defaultValues: lesson ?? {
      title: "",
      slug: "",
      description: "",
      courseId: defaultCourseId ?? courses[0]?.id ?? "",
      order: 0,
      durationSeconds: null,
      videoSource: "UPLOAD",
      videoKey: null,
      embedUrl: "",
      thumbnailKey: null,
      isPublished: false,
    },
  });
  const source = form.watch("videoSource");
  const videoKey = form.watch("videoKey");
  const thumbnailKey = form.watch("thumbnailKey");
  const duration = form.watch("durationSeconds");

  async function onSubmit(values: Values) {
    const res = await saveLesson(lesson?.id ?? null, values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Saqlandi");
    router.push("/super-admin/lessons");
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]" data-testid="lesson-form">
        <div className="card-surface grid gap-5 p-6">
          <FormField control={form.control} name="title" render={({ field }) => (
            <FormItem><FormLabel>Sarlavha</FormLabel><FormControl><Input {...field} data-testid="lesson-title" /></FormControl><FormMessage /></FormItem>
          )} />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField control={form.control} name="courseId" render={({ field }) => (
              <FormItem><FormLabel>Kurs</FormLabel><FormControl>
                <NativeSelect {...field} data-testid="lesson-course">
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </NativeSelect>
              </FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="slug" render={({ field }) => (
              <FormItem><FormLabel>Slug (URL)</FormLabel><FormControl><Input {...field} placeholder="avtomatik" /></FormControl><FormMessage /></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem><FormLabel>Tavsif</FormLabel><FormControl><Textarea rows={6} {...field} /></FormControl><FormMessage /></FormItem>
          )} />

          <div className="grid gap-3">
            <p className="text-sm font-medium">Video manbasi</p>
            <Tabs value={source} onValueChange={(v) => form.setValue("videoSource", v as "UPLOAD" | "EMBED", { shouldValidate: true })}>
              <TabsList>
                <TabsTrigger value="UPLOAD">Fayl yuklash</TabsTrigger>
                <TabsTrigger value="EMBED">Tashqi havola</TabsTrigger>
              </TabsList>
            </Tabs>
            {source === "UPLOAD" ? (
              <UploadField
                kind="video"
                accept="video/mp4,video/webm"
                label="Video fayl (MP4 yoki WEBM)"
                hint="Video himoyalangan papkada saqlanadi va faqat PRO foydalanuvchilarga uzatiladi."
                currentLabel={videoKey ? "Video yuklangan" : null}
                maxBytes={maxVideoBytes}
                onFileSelected={async (file) => {
                  const d = await readVideoDuration(file);
                  if (d) form.setValue("durationSeconds", d);
                }}
                onUploaded={(f) => form.setValue("videoKey", f.key, { shouldValidate: true })}
                onClear={() => form.setValue("videoKey", null)}
                testId="video-upload"
              />
            ) : (
              <FormField control={form.control} name="embedUrl" render={({ field }) => (
                <FormItem>
                  <FormControl><Input {...field} placeholder="https://youtu.be/… yoki https://vimeo.com/…" /></FormControl>
                  <FormDescription>YouTube (yashirin/unlisted), Vimeo yoki Bunny Stream havolasi. Havola faqat PRO foydalanuvchilarga ko‘rsatiladi, lekin tashqi platforma sozlamalarini ham himoyalang.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            )}
          </div>
        </div>

        <div className="grid content-start gap-6">
          <div className="card-surface grid gap-5 p-6">
            <UploadField
              kind="thumbnail"
              accept="image/png,image/jpeg,image/webp"
              label="Muqova rasmi (ixtiyoriy)"
              hint="16:9, PNG/JPG/WEBP"
              currentLabel={thumbnailKey ? "Rasm yuklangan" : null}
              onUploaded={(f) => form.setValue("thumbnailKey", f.key)}
              onClear={() => form.setValue("thumbnailKey", null)}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="order" render={({ field }) => (
                <FormItem><FormLabel>Tartib</FormLabel><FormControl><Input type="number" min={0} {...field} value={String(field.value ?? 0)} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="durationSeconds" render={({ field }) => (
                <FormItem><FormLabel>Davomiylik (s)</FormLabel><FormControl>
                  <Input type="number" min={0} value={field.value == null ? "" : String(field.value)} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} />
                </FormControl><FormDescription>{duration ? formatDuration(Number(duration)) : "Videodan avtomatik"}</FormDescription><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="isPublished" render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
                  <FormLabel>Nashr qilish</FormLabel>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="lesson-publish" /></FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <Button type="submit" size="lg" disabled={form.formState.isSubmitting} data-testid="lesson-save">
            {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Saqlash
          </Button>
        </div>
      </form>
    </Form>
  );
}
