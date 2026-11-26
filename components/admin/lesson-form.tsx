"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { saveLesson } from "@/lib/actions/admin/content";
import { lessonSchema } from "@/lib/validations/admin";
import { LEVEL_LABELS } from "@/lib/constants";
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
  categories,
  nextNumbers,
  defaultCourseId,
  maxVideoBytes,
  uploadsAvailable = true,
}: {
  lesson?: Values & { id: string };
  courses: { id: string; title: string; categoryId: string | null }[];
  categories: { id: string; name: string }[];
  /** First free lesson number per course (new lessons start there). */
  nextNumbers: Record<string, number>;
  defaultCourseId?: string;
  maxVideoBytes: number;
  /** False when files cannot be stored (Vercel without S3/R2): videos then come from a Bunny/YouTube link. */
  uploadsAvailable?: boolean;
}) {
  const router = useRouter();
  const startCourse = courses.find((c) => c.id === defaultCourseId) ?? courses[0];
  const form = useForm<Values>({
    resolver: zodResolver(lessonSchema),
    defaultValues: lesson ?? {
      title: "",
      slug: "",
      description: "",
      courseId: startCourse?.id ?? "",
      categoryId: startCourse?.categoryId ?? "",
      order: startCourse ? (nextNumbers[startCourse.id] ?? 1) : 1,
      level: null,
      isFree: false,
      durationSeconds: null,
      videoSource: uploadsAvailable ? "UPLOAD" : "EMBED",
      videoKey: null,
      embedUrl: "",
      thumbnailKey: null,
      isPublished: false,
    },
  });
  // useWatch (not form.watch): subscribes this component to the fields so React Compiler can memoize it.
  const [source, categoryId, number, title, videoKey, thumbnailKey, duration] = useWatch({
    control: form.control,
    name: ["videoSource", "categoryId", "order", "title", "videoKey", "thumbnailKey", "durationSeconds"],
  });
  const categoryName = categories.find((c) => c.id === categoryId)?.name;

  /** Never fail silently: name the first field that blocks saving (also ones without a visible message). */
  function onInvalid(errors: Record<string, { message?: string } | undefined>) {
    const [field, err] = Object.entries(errors).find(([, e]) => e?.message) ?? [];
    toast.error(err?.message ? `${err.message}` : "Formada xato bor — maydonlarni tekshiring");
    if (process.env.NODE_ENV !== "production") console.warn("[form] invalid", field, errors);
  }

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
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]" data-testid="lesson-form">
        <div className="card-surface grid gap-5 p-6">
          <FormField control={form.control} name="title" render={({ field }) => (
            <FormItem><FormLabel>Video dars nomi</FormLabel><FormControl><Input {...field} data-testid="lesson-title" /></FormControl><FormMessage /></FormItem>
          )} />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField control={form.control} name="categoryId" render={({ field }) => (
              <FormItem><FormLabel>Kategoriya</FormLabel><FormControl>
                <NativeSelect {...field} data-testid="lesson-category">
                  <option value="">Tanlang…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </NativeSelect>
              </FormControl>
              {categories.length === 0 && <FormDescription>Avval Super admin → Kategoriyalar bo‘limida kategoriya yarating.</FormDescription>}
              <FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="courseId" render={({ field }) => (
              <FormItem><FormLabel>Kurs</FormLabel><FormControl>
                <NativeSelect
                  {...field}
                  data-testid="lesson-course"
                  onChange={(e) => {
                    field.onChange(e);
                    if (!lesson) {
                      const c = courses.find((x) => x.id === e.target.value);
                      form.setValue("order", nextNumbers[e.target.value] ?? 1);
                      if (c?.categoryId && !form.getValues("categoryId")) form.setValue("categoryId", c.categoryId);
                    }
                  }}
                >
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </NativeSelect>
              </FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="order" render={({ field }) => (
              <FormItem><FormLabel>Dars raqami</FormLabel><FormControl>
                <Input type="number" min={1} step={1} inputMode="numeric" {...field} value={String(field.value ?? "")} data-testid="lesson-number" />
              </FormControl><FormDescription>Kurs ichida takrorlanmaydi. Tartib shu raqam bo‘yicha.</FormDescription><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="level" render={({ field }) => (
              <FormItem><FormLabel>Kirish darajasi</FormLabel><FormControl>
                <NativeSelect value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} data-testid="lesson-level">
                  <option value="">Ko‘rsatilmagan</option>
                  {Object.entries(LEVEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </NativeSelect>
              </FormControl><FormMessage /></FormItem>
            )} />
          </div>
          {(categoryName || title) && (
            <div className="rounded-xl border border-border bg-surface px-4 py-3" data-testid="lesson-heading-preview">
              <p className="font-mono text-[11px] tracking-[0.14em] text-gold-soft uppercase">
                {[categoryName, number ? `${number}-dars` : null].filter(Boolean).join(" — ")}
              </p>
              <p className="mt-1 font-display font-semibold">{title || "Dars nomi"}</p>
            </div>
          )}
          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem><FormLabel>Dars tavsifi</FormLabel><FormControl><Textarea rows={5} {...field} /></FormControl><FormMessage /></FormItem>
          )} />

          <div className="grid gap-3">
            <p className="text-sm font-medium">Video manbasi</p>
            <Tabs value={source} onValueChange={(v) => form.setValue("videoSource", v as "UPLOAD" | "EMBED", { shouldValidate: true })}>
              <TabsList>
                <TabsTrigger value="UPLOAD">Fayl yuklash</TabsTrigger>
                <TabsTrigger value="EMBED">{uploadsAvailable ? "Tashqi havola" : "Bunny Stream / havola"}</TabsTrigger>
              </TabsList>
            </Tabs>
            {source === "UPLOAD" && !uploadsAvailable ? (
              <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground" data-testid="uploads-unavailable">
                Fayl saqlash hali ulanmagan: Vercel’da videolar Cloudflare R2 (S3) omborida saqlanadi — administrator S3_*
                sozlamalarini kiritgach, shu yerdan yuklash ishlaydi (docs/FAYL-SAQLASH.md). Hozircha videoni Bunny Stream’ga
                yuklab, «Bunny Stream / havola» bo‘limiga Embed havolasini qo‘yishingiz mumkin.
              </p>
            ) : source === "UPLOAD" ? (
              <UploadField
                kind="video"
                accept="video/mp4,video/webm"
                label="Video fayl (MP4 yoki WEBM)"
                hint="To‘g‘ridan-to‘g‘ri himoyalangan omborga yuklanadi (katta fayllar bo‘laklab, uzilsa qayta urinadi)."
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
                  <FormControl><Input {...field} placeholder="https://iframe.mediadelivery.net/embed/123456/…" data-testid="lesson-embed-url" /></FormControl>
                  <FormDescription>
                    Bunny Stream (tavsiya): Video → Embed bo‘limidagi havola. Token himoyasi yoqilgan bo‘lsa, sayt har bir PRO
                    foydalanuvchiga 6 soat amal qiladigan alohida havola beradi. YouTube va Vimeo havolalari ham qabul qilinadi.
                  </FormDescription>
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
              hint={uploadsAvailable ? "16:9, PNG/JPG/WEBP" : "Fayl saqlash ulanmagan — bo‘sh qoldiring, pleyer o‘z rasmini ko‘rsatadi."}
              currentLabel={thumbnailKey ? "Rasm yuklangan" : null}
              onUploaded={(f) => form.setValue("thumbnailKey", f.key)}
              onClear={() => form.setValue("thumbnailKey", null)}
            />
            <FormField control={form.control} name="durationSeconds" render={({ field }) => (
              <FormItem><FormLabel>Davomiyligi (soniya)</FormLabel><FormControl>
                <Input type="number" min={0} value={field.value == null ? "" : String(field.value)} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} data-testid="lesson-duration" />
              </FormControl><FormDescription>{duration ? formatDuration(Number(duration)) : "Video fayl tanlanganda avtomatik aniqlanadi"}</FormDescription><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="isFree" render={({ field }) => (
              <FormItem><FormLabel>Foydalanish huquqi</FormLabel><FormControl>
                <NativeSelect value={field.value ? "FREE" : "PRO"} onChange={(e) => field.onChange(e.target.value === "FREE")} data-testid="lesson-access">
                  <option value="PRO">PRO — faqat obunachilar</option>
                  <option value="FREE">Bepul — ro‘yxatdan o‘tgan hamma</option>
                </NativeSelect>
              </FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="isPublished" render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
                  <div>
                    <FormLabel>Holati</FormLabel>
                    <p className="text-xs text-muted-foreground">{field.value ? "Nashr qilingan" : "Qoralama — faqat adminlar ko‘radi"}</p>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="lesson-publish" aria-label="Nashr qilish" /></FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="slug" render={({ field }) => (
              <FormItem><FormLabel>Slug (URL)</FormLabel><FormControl><Input {...field} placeholder="avtomatik" /></FormControl><FormMessage /></FormItem>
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
