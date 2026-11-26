"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { saveBook } from "@/lib/actions/admin/content";
import { bookSchema } from "@/lib/validations/admin";
import { formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { uploadFile, UploadField } from "./upload-field";

type Values = z.input<typeof bookSchema>;

/** Reads page count, title/author metadata and renders page 1 as a cover (client-side, pdf.js). */
async function inspectPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    const meta = await doc.getMetadata().catch(() => null);
    const info = (meta?.info ?? {}) as { Title?: string; Author?: string };
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 640 / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvas, viewport }).promise;
    const cover = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    return { pages: doc.numPages, title: info.Title?.trim() || null, author: info.Author?.trim() || null, cover };
  } finally {
    await doc.loadingTask.destroy();
  }
}

export function BookForm({
  book,
  categories,
  maxBookBytes,
  coverUrl,
}: {
  book?: Values & { id: string };
  categories: { id: string; name: string }[];
  maxBookBytes: number;
  coverUrl?: string | null;
}) {
  const router = useRouter();
  const [preview, setPreview] = React.useState<string | null>(coverUrl ?? null);
  const form = useForm<Values>({
    resolver: zodResolver(bookSchema),
    defaultValues: book ?? {
      title: "",
      slug: "",
      author: "",
      description: "",
      pageCount: null,
      categoryId: "",
      fileKey: "",
      fileSize: 0,
      coverKey: null,
      order: 0,
      isPublished: false,
    },
  });
  const [fileKey, fileSize, coverKey] = useWatch({ control: form.control, name: ["fileKey", "fileSize", "coverKey"] });

  async function onPdfSelected(file: File) {
    try {
      const info = await inspectPdf(file);
      form.setValue("pageCount", info.pages);
      if (!form.getValues("title") && info.title && !/^microsoft|^untitled/i.test(info.title)) form.setValue("title", info.title);
      if (!form.getValues("author") && info.author && !/пользователь|user|admin/i.test(info.author)) form.setValue("author", info.author);
      if (!form.getValues("coverKey") && info.cover) {
        const uploaded = await uploadFile("cover", info.cover);
        form.setValue("coverKey", uploaded.key);
        setPreview(URL.createObjectURL(info.cover));
        toast.success("Muqova PDF’ning 1-betidan olindi");
      }
    } catch {
      toast.message("PDF ma’lumotlarini o‘qib bo‘lmadi — sahifalar sonini qo‘lda kiriting");
    }
  }

  /** Never fail silently: name the first field that blocks saving (also ones without a visible message). */
  function onInvalid(errors: Record<string, { message?: string } | undefined>) {
    const [field, err] = Object.entries(errors).find(([, e]) => e?.message) ?? [];
    toast.error(err?.message ? `${err.message}` : "Formada xato bor — maydonlarni tekshiring");
    if (process.env.NODE_ENV !== "production") console.warn("[form] invalid", field, errors);
  }

  async function onSubmit(values: Values) {
    const res = await saveBook(book?.id ?? null, values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Saqlandi");
    router.push("/super-admin/books");
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]" data-testid="book-form">
        <div className="card-surface grid gap-5 p-6">
          <UploadField
            kind="book"
            accept="application/pdf"
            label="PDF fayl"
            hint="Asl fayl o‘zgartirilmasdan himoyalangan papkada saqlanadi."
            currentLabel={fileKey ? `PDF yuklangan · ${formatBytes(Number(fileSize) || 0)}` : null}
            maxBytes={maxBookBytes}
            onFileSelected={onPdfSelected}
            onUploaded={(f) => {
              form.setValue("fileKey", f.key, { shouldValidate: true });
              form.setValue("fileSize", f.size);
            }}
            testId="book-upload"
          />
          {form.formState.errors.fileKey && <p className="text-xs text-red-300">{form.formState.errors.fileKey.message}</p>}
          <FormField control={form.control} name="title" render={({ field }) => (
            <FormItem><FormLabel>Sarlavha</FormLabel><FormControl><Input {...field} data-testid="book-title" /></FormControl><FormMessage /></FormItem>
          )} />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField control={form.control} name="author" render={({ field }) => (
              <FormItem><FormLabel>Muallif</FormLabel><FormControl><Input {...field} placeholder="Ma’lum bo‘lsa" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="slug" render={({ field }) => (
              <FormItem><FormLabel>Slug (URL)</FormLabel><FormControl><Input {...field} placeholder="avtomatik" /></FormControl><FormMessage /></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem><FormLabel>Tavsif</FormLabel><FormControl><Textarea rows={5} {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <FormField control={form.control} name="categoryId" render={({ field }) => (
              <FormItem><FormLabel>Kategoriya</FormLabel><FormControl>
                <NativeSelect {...field}>
                  <option value="">Kategoriyasiz</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </NativeSelect>
              </FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="pageCount" render={({ field }) => (
              <FormItem><FormLabel>Betlar soni</FormLabel><FormControl>
                <Input type="number" min={1} value={field.value == null ? "" : String(field.value)} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} />
              </FormControl><FormDescription>PDF’dan avtomatik</FormDescription><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="order" render={({ field }) => (
              <FormItem><FormLabel>Tartib</FormLabel><FormControl><Input type="number" min={0} {...field} value={String(field.value ?? 0)} /></FormControl><FormMessage /></FormItem>
            )} />
          </div>
        </div>

        <div className="grid content-start gap-6">
          <div className="card-surface grid gap-4 p-6">
            {preview && (
              <div className="relative mx-auto aspect-[1/1.414] w-40 overflow-hidden rounded-lg border border-border">
                <Image src={preview} alt="Muqova" fill sizes="160px" className="object-cover" unoptimized />
              </div>
            )}
            <UploadField
              kind="cover"
              accept="image/png,image/jpeg,image/webp"
              label="Muqova"
              hint="PDF yuklanganda 1-bet avtomatik olinadi; xohlasangiz almashtiring."
              currentLabel={coverKey ? "Muqova mavjud" : null}
              onUploaded={(f, original) => {
                form.setValue("coverKey", f.key);
                setPreview(URL.createObjectURL(original));
              }}
              onClear={() => {
                form.setValue("coverKey", null);
                setPreview(null);
              }}
            />
            <FormField control={form.control} name="isPublished" render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
                <FormLabel>Nashr qilish</FormLabel>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )} />
            <p className="text-xs leading-relaxed text-muted-foreground">Faqat tarqatish huquqi platformaga tegishli bo‘lgan kitoblarni nashr qiling.</p>
          </div>
          <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Saqlash
          </Button>
        </div>
      </form>
    </Form>
  );
}
