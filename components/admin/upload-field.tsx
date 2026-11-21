"use client";

import * as React from "react";
import { CheckCircle2Icon, Loader2Icon, UploadCloudIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { cn, formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export type UploadKind = "video" | "book" | "cover" | "thumbnail" | "founder";
export type UploadedFile = { key: string; size: number; mime: string };

/** Uploads a file to /api/admin/upload with progress (XHR) and returns the storage key. */
export function uploadFile(kind: UploadKind, file: File | Blob, onProgress?: (pct: number) => void) {
  return new Promise<UploadedFile>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/admin/upload?kind=${kind}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let json: { error?: string } & Partial<UploadedFile> = {};
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300 && json.key) resolve(json as UploadedFile);
      else reject(new Error(json.error ?? `Yuklashda xatolik (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Tarmoq xatosi — yuklash to‘xtadi"));
    xhr.send(file);
  });
}

export function UploadField({
  kind,
  accept,
  label,
  hint,
  currentLabel,
  onUploaded,
  onFileSelected,
  onClear,
  maxBytes,
  testId,
}: {
  kind: UploadKind;
  accept: string;
  label: string;
  hint?: string;
  currentLabel?: string | null;
  onUploaded: (file: UploadedFile, original: File) => void;
  onFileSelected?: (file: File) => void | Promise<void>;
  onClear?: () => void;
  maxBytes?: number;
  testId?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [name, setName] = React.useState<string | null>(null);

  async function handle(file: File) {
    if (maxBytes && file.size > maxBytes) {
      toast.error(`Fayl hajmi ${formatBytes(maxBytes)} dan oshmasin`);
      return;
    }
    setName(file.name);
    setProgress(0);
    try {
      await onFileSelected?.(file);
      const res = await uploadFile(kind, file, setProgress);
      onUploaded(res, file);
      toast.success("Fayl yuklandi");
    } catch (err) {
      setName(null);
      toast.error(err instanceof Error ? err.message : "Yuklashda xatolik");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const uploading = progress !== null;
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium text-foreground/90">{label}</p>
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface px-4 py-4",
          uploading && "border-primary/50",
        )}
      >
        {uploading ? <Loader2Icon className="size-5 animate-spin text-gold-soft" /> : currentLabel ? <CheckCircle2Icon className="size-5 text-success" /> : <UploadCloudIcon className="size-5 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{uploading ? name : (currentLabel ?? "Fayl tanlanmagan")}</p>
          {uploading && <Progress value={progress} className="mt-2 h-1.5" />}
          {hint && !uploading && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
          data-testid={testId}
        />
        <Button type="button" variant="secondary" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {currentLabel ? "Almashtirish" : "Tanlash"}
        </Button>
        {currentLabel && onClear && !uploading && (
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Olib tashlash" onClick={onClear}>
            <XIcon />
          </Button>
        )}
      </div>
    </div>
  );
}
