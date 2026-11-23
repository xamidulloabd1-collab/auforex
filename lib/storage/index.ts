import "server-only";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { env } from "@/lib/env";
import { detectFileType, UPLOAD_KINDS, type DetectedFile, type UploadKind } from "./file-types";
import { isValidStorageKey, newStorageKey, type StorageArea } from "./keys";

export class UploadError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export type StoredFile = { key: string; size: number; mime: string };

export type ReadRange = { start: number; end: number };

/** Provider interface — implement this for S3/R2/Bunny etc. and select it via STORAGE_DRIVER. */
export interface StorageDriver {
  /** Streams `body` into storage. Validates magic bytes against `allowedMimes` and enforces `maxBytes`. */
  putStream(
    area: StorageArea,
    body: ReadableStream<Uint8Array>,
    opts: { maxBytes: number; allowedMimes: readonly string[] },
  ): Promise<StoredFile>;
  putBuffer(key: string, data: Uint8Array): Promise<void>;
  stat(key: string): Promise<{ size: number } | null>;
  read(key: string, range?: ReadRange): ReadableStream<Uint8Array>;
  delete(key: string): Promise<void>;
}

class LocalStorageDriver implements StorageDriver {
  constructor(private readonly root: string) {}

  private resolve(key: string) {
    if (!isValidStorageKey(key)) throw new UploadError("Invalid storage key", 400);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new UploadError("Invalid path", 400);
    return full;
  }

  async putStream(
    area: StorageArea,
    body: ReadableStream<Uint8Array>,
    opts: { maxBytes: number; allowedMimes: readonly string[] },
  ): Promise<StoredFile> {
    const reader = body.getReader();
    let detected: DetectedFile | null = null;
    let head = new Uint8Array(0);
    let size = 0;
    let key = "";
    let tmpPath = "";
    let out: ReturnType<typeof createWriteStream> | null = null;

    const write = (chunk: Uint8Array) =>
      new Promise<void>((resolve, reject) => {
        out!.write(chunk, (err) => (err ? reject(err) : resolve()));
      });

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value?.length) continue;
        size += value.length;
        if (size > opts.maxBytes) {
          throw new UploadError(`Fayl hajmi ruxsat etilgan chegaradan oshdi (${Math.round(opts.maxBytes / 1024 / 1024)} MB)`, 413);
        }
        if (!detected) {
          const merged = new Uint8Array(head.length + value.length);
          merged.set(head);
          merged.set(value, head.length);
          head = merged;
          if (head.length < 16) continue;
          detected = detectFileType(head);
          if (!detected || !opts.allowedMimes.includes(detected.mime)) {
            throw new UploadError("Fayl turi qo‘llab-quvvatlanmaydi", 415);
          }
          key = newStorageKey(area, detected.ext);
          const full = this.resolve(key);
          await mkdir(path.dirname(full), { recursive: true });
          tmpPath = `${full}.part`;
          out = createWriteStream(tmpPath, { flags: "wx" });
          await write(head);
          continue;
        }
        await write(value);
      }

      if (!detected) {
        // Small files (< 16 bytes) are never valid media.
        throw new UploadError("Fayl bo‘sh yoki juda kichik", 400);
      }
      await new Promise<void>((resolve, reject) => out!.end((err?: Error | null) => (err ? reject(err) : resolve())));
      await rename(tmpPath, this.resolve(key));
      return { key, size, mime: detected.mime };
    } catch (err) {
      reader.cancel().catch(() => {});
      if (out) out.destroy();
      if (tmpPath) await rm(tmpPath, { force: true }).catch(() => {});
      throw err;
    }
  }

  async putBuffer(key: string, data: Uint8Array) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(full);
      ws.on("error", reject);
      ws.end(data, () => resolve());
    });
  }

  async stat(key: string) {
    try {
      const s = await stat(this.resolve(key));
      return s.isFile() ? { size: s.size } : null;
    } catch {
      return null;
    }
  }

  read(key: string, range?: ReadRange): ReadableStream<Uint8Array> {
    const stream = createReadStream(this.resolve(key), range ? { start: range.start, end: range.end } : undefined);
    return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
  }

  async delete(key: string) {
    if (!isValidStorageKey(key)) return;
    await rm(this.resolve(key), { force: true });
  }
}

let driver: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (driver) return driver;
  const e = env();
  switch (e.STORAGE_DRIVER) {
    case "local":
      driver = new LocalStorageDriver(path.resolve(/*turbopackIgnore: true*/ process.cwd(), e.STORAGE_LOCAL_ROOT));
      break;
  }
  return driver!;
}

/** Vercel runs the app from a read-only file system: uploaded files cannot be saved there. */
export function isReadOnlyHost() {
  return process.env.VERCEL === "1";
}

export function uploadLimitBytes(kind: UploadKind) {
  const e = env();
  const mb =
    kind === "video" ? e.MAX_VIDEO_UPLOAD_MB : kind === "book" ? e.MAX_BOOK_UPLOAD_MB : e.MAX_IMAGE_UPLOAD_MB;
  return mb * 1024 * 1024;
}

/** Streams an upload request body into storage for the given kind. */
export async function storeUpload(kind: UploadKind, body: ReadableStream<Uint8Array> | null) {
  if (!body) throw new UploadError("Fayl yuborilmadi", 400);
  if (isReadOnlyHost()) {
    body.cancel().catch(() => {});
    throw new UploadError(
      kind === "video"
        ? "Vercel’da video faylni saytga yuklab bo‘lmaydi. Videoni Bunny Stream’ga yuklab, Embed havolasini qo‘ying."
        : "Vercel’da fayl yuklash hozircha ishlamaydi (server diski faqat o‘qish uchun).",
      503,
    );
  }
  const cfg = UPLOAD_KINDS[kind];
  return getStorage().putStream(cfg.area, body, {
    maxBytes: uploadLimitBytes(kind),
    allowedMimes: cfg.mimes,
  });
}

/** Best-effort deletion (used when content is replaced or removed). */
export async function deleteStoredFile(key: string | null | undefined) {
  if (!key) return;
  try {
    await getStorage().delete(key);
  } catch (err) {
    console.error("[storage] failed to delete", key, err);
  }
}
