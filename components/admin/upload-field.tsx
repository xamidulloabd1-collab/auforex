"use client";

import * as React from "react";
import { CheckCircle2Icon, Loader2Icon, UploadCloudIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { cn, formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export type UploadKind = "video" | "book" | "cover" | "thumbnail" | "founder";
export type UploadedFile = { key: string; size: number; mime: string };

class UploadCancelled extends Error {
  constructor() {
    super("Yuklash bekor qilindi");
  }
}

type Plan =
  | { mode: "proxy" }
  | { mode: "single"; token: string; url: string; contentType: string }
  | { mode: "multipart"; token: string; partSize: number; urls: string[] };

async function postJson<T>(body: unknown): Promise<T> {
  const res = await fetch("/api/admin/uploads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Yuklashda xatolik (${res.status})`);
  return json;
}

/** Parts sent at the same time in a multipart upload. */
const PARALLEL_PARTS = 4;
/** A request that sends no bytes for this long is treated as a dropped connection and retried. */
const STALL_MS = 60_000;

/** One XHR PUT with progress; resolves with the response (ETag header for multipart parts). */
function put(url: string, body: Blob, headers: Record<string, string>, onBytes: (n: number) => void, signal?: AbortSignal) {
  return new Promise<{ status: number; etag: string | null; text: string }>((resolve, reject) => {
    if (signal?.aborted) return reject(new UploadCancelled());
    const xhr = new XMLHttpRequest();
    let stalled = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        stalled = true;
        xhr.abort();
      }, STALL_MS);
    };
    const onAbort = () => xhr.abort();
    const done = () => {
      clearTimeout(watchdog);
      signal?.removeEventListener("abort", onAbort);
    };
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      arm();
      onBytes(e.loaded);
    };
    xhr.onload = () => {
      done();
      resolve({ status: xhr.status, etag: xhr.getResponseHeader("ETag"), text: xhr.responseText });
    };
    xhr.onerror = () => {
      done();
      reject(new Error("Tarmoq yoki CORS xatosi — R2 CORS’da sayt manzili, PUT va Content-Type’ni tekshiring"));
    };
    xhr.onabort = () => {
      done();
      reject(stalled ? new Error("Ulanish uzilib qoldi — qayta urinilmoqda") : new UploadCancelled());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    arm();
    xhr.send(body);
  });
}

/** Retries transient failures (network, 5xx, 429) with a growing pause; 4xx is final. */
async function withRetries<T>(run: () => Promise<{ status: number } & T>, signal?: AbortSignal, attempts = 4) {
  for (let i = 1; ; i++) {
    try {
      const r = await run();
      if (r.status >= 200 && r.status < 300) return r;
      if (r.status < 500 && r.status !== 429) throw Object.assign(new Error(`Ombor so‘rovni rad etdi (${r.status})`), { final: true });
      if (i >= attempts) throw new Error(`Ombor javob bermadi (${r.status})`);
    } catch (err) {
      if (err instanceof UploadCancelled || (err as { final?: boolean }).final || i >= attempts) throw err;
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** (i - 1)));
    if (signal?.aborted) throw new UploadCancelled();
  }
}

/** Legacy path for local-disk storage: the file is streamed through the app. */
function proxyUpload(kind: UploadKind, file: Blob, onProgress?: (pct: number) => void, signal?: AbortSignal) {
  return new Promise<UploadedFile>((resolve, reject) => {
    if (signal?.aborted) return reject(new UploadCancelled());
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
    xhr.onabort = () => reject(new UploadCancelled());
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

/**
 * Uploads a file and returns its storage key. With object storage (Vercel) the browser sends
 * the file straight to the bucket — large files in 10 MiB parts, each retried on failure;
 * with local disk it goes through /api/admin/upload. Cancel with `signal`.
 */
export async function uploadFile(kind: UploadKind, file: File | Blob, onProgress?: (pct: number) => void, signal?: AbortSignal) {
  const name = file instanceof File ? file.name : "upload";
  const plan = await postJson<Plan>({ action: "init", kind, size: file.size, name, type: file.type });
  // "Bekor qilish" pressed while the upload was being prepared: stop before sending any data.
  if (signal?.aborted) {
    if (plan.mode !== "proxy") await postJson({ action: "abort", token: plan.token }).catch(() => {});
    throw new UploadCancelled();
  }
  if (plan.mode === "proxy") return proxyUpload(kind, file, onProgress, signal);

  const report = (sent: number) => onProgress?.(Math.min(99, Math.round((sent / file.size) * 100)));
  // Stops the other parts as soon as one fails for good (or "Bekor qilish" is pressed).
  const stop = new AbortController();
  const onCancel = () => stop.abort();
  signal?.addEventListener("abort", onCancel, { once: true });
  try {
    let etags: string[] | undefined;
    if (plan.mode === "single") {
      await withRetries(() => put(plan.url, file, { "Content-Type": plan.contentType }, report, stop.signal), stop.signal);
    } else {
      const parts = plan.urls.length;
      const list: string[] = new Array(parts);
      const sent = new Array<number>(parts).fill(0);
      const total = () => sent.reduce((a, b) => a + b, 0);
      let next = 0;
      // A few parts at a time: much faster than one by one, still gentle on a home connection.
      const worker = async () => {
        while (next < parts) {
          const i = next++;
          const part = file.slice(i * plan.partSize, Math.min(file.size, (i + 1) * plan.partSize));
          const r = await withRetries(
            () =>
              put(plan.urls[i]!, part, {}, (n) => {
                sent[i] = n;
                report(total());
              }, stop.signal),
            stop.signal,
          );
          if (!r.etag) throw new Error("Ombor ETag qaytarmadi — bucket CORS’da ExposeHeaders: [\"ETag\"] kerak");
          list[i] = r.etag;
          sent[i] = part.size;
          report(total());
        }
      };
      try {
        await Promise.all(Array.from({ length: Math.min(PARALLEL_PARTS, parts) }, worker));
      } catch (err) {
        stop.abort();
        throw err;
      }
      etags = list;
    }
    const stored = await postJson<UploadedFile>({ action: "complete", token: plan.token, etags });
    onProgress?.(100);
    return stored;
  } catch (err) {
    await postJson({ action: "abort", token: plan.token }).catch(() => {});
    throw signal?.aborted ? new UploadCancelled() : err;
  } finally {
    signal?.removeEventListener("abort", onCancel);
  }
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
  const abortRef = React.useRef<AbortController | null>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [name, setName] = React.useState<string | null>(null);
  React.useEffect(() => () => abortRef.current?.abort(), []);

  async function handle(file: File) {
    if (maxBytes && file.size > maxBytes) {
      toast.error(`Fayl hajmi ${formatBytes(maxBytes)} dan oshmasin`);
      return;
    }
    setName(file.name);
    setProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await onFileSelected?.(file);
      const res = await uploadFile(kind, file, setProgress, controller.signal);
      onUploaded(res, file);
      toast.success("Fayl yuklandi");
    } catch (err) {
      setName(null);
      if (err instanceof UploadCancelled) toast.message("Yuklash bekor qilindi");
      else toast.error(err instanceof Error ? err.message : "Yuklashda xatolik");
    } finally {
      abortRef.current = null;
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
          {uploading && (
            <div className="mt-2 flex items-center gap-2">
              <Progress value={progress} className="h-1.5 flex-1" />
              <span className="w-10 text-right font-mono text-xs text-muted-foreground" data-testid={testId ? `${testId}-progress` : undefined}>
                {progress}%
              </span>
            </div>
          )}
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
        {uploading ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => abortRef.current?.abort()} data-testid={testId ? `${testId}-cancel` : undefined}>
            Bekor qilish
          </Button>
        ) : (
          <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            {currentLabel ? "Almashtirish" : "Tanlash"}
          </Button>
        )}
        {currentLabel && onClear && !uploading && (
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Olib tashlash" onClick={onClear}>
            <XIcon />
          </Button>
        )}
      </div>
    </div>
  );
}
