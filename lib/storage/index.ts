import "server-only";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { detectFileType, UPLOAD_KINDS, type DetectedFile, type UploadKind } from "./file-types";
import { isBundledKey, isValidStorageKey, newStorageKey, type StorageArea } from "./keys";
import { parseS3Config } from "./config";
import { S3Client, type S3Config } from "./s3";

/**
 * A file as a web stream. Unlike Readable.toWeb, a viewer who stops loading (video seek, closed
 * tab, the PDF reader cancelling a range) only closes the file — it can never throw
 * "Controller is already closed" as an uncaught exception and take the server instance down.
 */
export function fileStream(file: string, range?: ReadRange): ReadableStream<Uint8Array> {
  const node = createReadStream(file, range ? { start: range.start, end: range.end } : undefined);
  let done = false;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      node.on("data", (chunk) => {
        if (done) return;
        controller.enqueue(typeof chunk === "string" ? new TextEncoder().encode(chunk) : new Uint8Array(chunk));
        if ((controller.desiredSize ?? 1) <= 0) node.pause();
      });
      node.on("end", () => {
        if (done) return;
        done = true;
        controller.close();
      });
      node.on("error", (err) => {
        if (done) return;
        done = true;
        controller.error(err);
      });
    },
    pull() {
      node.resume();
    },
    cancel() {
      done = true;
      node.destroy();
    },
  });
}

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

/** Provider interface: local disk (development, Docker) or S3-compatible object storage (Vercel). */
export interface StorageDriver {
  readonly name: "local" | "s3";
  /** False when files cannot be saved (local disk on Vercel, which is read-only). */
  readonly writable: boolean;
  /** Largest body one response may carry on this host (Vercel: 4.5 MB); ranges are sliced to it. */
  readonly maxResponseBytes?: number;
  /** S3 only: a short-lived URL the browser can fetch the object from directly. */
  signedReadUrl?(key: string, expiresSeconds: number): string;
  /** S3 only: the client used for direct browser uploads. */
  readonly s3?: S3Client;
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
  readonly name = "local" as const;
  constructor(
    private readonly root: string,
    readonly writable = true,
  ) {}

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
    return fileStream(this.resolve(key), range);
  }

  async delete(key: string) {
    if (!isValidStorageKey(key)) return;
    await rm(this.resolve(key), { force: true });
  }
}

/* ------------------------------------------------------------------ S3 / R2 */

/** Vercel: 4.5 MB per function response — larger ranges are answered in 4 MiB slices. */
const SERVERLESS_MAX_RESPONSE = 4 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

export function mimeForKey(key: string) {
  return MIME_BY_EXT[key.split(".").pop() ?? ""] ?? "application/octet-stream";
}

class S3StorageDriver implements StorageDriver {
  readonly name = "s3" as const;
  readonly writable = true;
  readonly maxResponseBytes = process.env.VERCEL === "1" ? SERVERLESS_MAX_RESPONSE : undefined;
  constructor(readonly s3: S3Client) {}

  /** Single-request uploads (avatars, challenge screenshots): small, so they are buffered. */
  async putStream(area: StorageArea, body: ReadableStream<Uint8Array>, opts: { maxBytes: number; allowedMimes: readonly string[] }) {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > opts.maxBytes) {
          throw new UploadError(`Fayl hajmi ruxsat etilgan chegaradan oshdi (${Math.round(opts.maxBytes / 1024 / 1024)} MB)`, 413);
        }
        chunks.push(value);
      }
    } catch (err) {
      reader.cancel().catch(() => {});
      throw err;
    }
    const data = Buffer.concat(chunks);
    const detected = detectFileType(data.subarray(0, 64));
    if (!detected) throw new UploadError(size ? "Fayl turi qo‘llab-quvvatlanmaydi" : "Fayl bo‘sh", size ? 415 : 400);
    if (!opts.allowedMimes.includes(detected.mime)) throw new UploadError("Fayl turi qo‘llab-quvvatlanmaydi", 415);
    const key = newStorageKey(area, detected.ext);
    await this.s3.put(key, data, detected.mime);
    return { key, size, mime: detected.mime };
  }

  async putBuffer(key: string, data: Uint8Array) {
    if (!isValidStorageKey(key) || isBundledKey(key)) throw new UploadError("Invalid storage key", 400);
    await this.s3.put(key, data, mimeForKey(key));
  }

  async stat(key: string) {
    if (!isValidStorageKey(key)) return null;
    const info = await this.s3.head(key);
    return info ? { size: info.size } : null;
  }

  read(key: string, range?: ReadRange): ReadableStream<Uint8Array> {
    const s3 = this.s3;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (!reader) {
          const res = await s3.get(key, range);
          if (!res.body) return controller.close();
          reader = res.body.getReader();
        }
        const { done, value } = await reader.read();
        if (done) controller.close();
        else controller.enqueue(value);
      },
      cancel(reason) {
        return reader?.cancel(reason);
      },
    });
  }

  async delete(key: string) {
    if (!isValidStorageKey(key) || isBundledKey(key)) return;
    await this.s3.delete(key);
  }

  signedReadUrl(key: string, expiresSeconds: number) {
    return this.s3.presignGet(key, expiresSeconds);
  }
}

/* ------------------------------------------------------------------ seeded files in the bundle */

/** Folder with the seeded books and covers that ship with the app. */
function bundledRoot() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "prisma", "seed-assets");
}

/**
 * Serves `bundled/…` keys read-only from `prisma/seed-assets` (traced into the deployment, see
 * next.config.ts) and passes every other key to the configured driver.
 */
function withBundled(inner: StorageDriver): StorageDriver {
  const local = (key: string) => path.join(bundledRoot(), key.slice("bundled/".length));
  return {
    name: inner.name,
    writable: inner.writable,
    maxResponseBytes: inner.maxResponseBytes,
    s3: inner.s3,
    signedReadUrl: inner.signedReadUrl?.bind(inner),
    putStream: (area, body, opts) => inner.putStream(area, body, opts),
    putBuffer: (key, data) => (isBundledKey(key) ? Promise.reject(new UploadError("Read-only file", 400)) : inner.putBuffer(key, data)),
    async stat(key) {
      if (!isBundledKey(key)) return inner.stat(key);
      try {
        const s = await stat(local(key));
        return s.isFile() ? { size: s.size } : null;
      } catch {
        return null;
      }
    },
    read(key, range) {
      if (!isBundledKey(key)) return inner.read(key, range);
      return fileStream(local(key), range);
    },
    delete: (key) => (isBundledKey(key) ? Promise.resolve() : inner.delete(key)),
  };
}

/* ------------------------------------------------------------------ selection */

/** S3_* settings as a client config; throws a clear 503 when they are present but wrong. */
export function s3ConfigFromEnv(source: Record<string, string | undefined> = process.env): S3Config | null {
  const parsed = parseS3Config(source);
  if (!parsed.ok) throw new UploadError(`Fayl ombori sozlamasi noto‘g‘ri: ${parsed.error}`, 503);
  return parsed.config;
}

/** Vercel runs the app from a read-only file system: files can only be kept in object storage. */
export function isReadOnlyHost() {
  return process.env.VERCEL === "1";
}

let driver: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (driver) return driver;
  const e = env();
  const s3 = s3ConfigFromEnv(process.env);
  const useS3 = e.STORAGE_DRIVER === "s3" || (!e.STORAGE_DRIVER && s3);
  driver = withBundled(
    useS3 && s3
      ? new S3StorageDriver(new S3Client(s3))
      : new LocalStorageDriver(path.resolve(/*turbopackIgnore: true*/ process.cwd(), e.STORAGE_LOCAL_ROOT), !isReadOnlyHost()),
  );
  return driver;
}

/** For tests: forget the cached driver so the next call re-reads the environment. */
export function resetStorageForTests() {
  driver = null;
}

/** Driver and whether uploads work; a configuration error is reported instead of thrown. */
export function storageStatus(): { driver: "local" | "s3"; uploads: boolean; error?: string } {
  try {
    const s = getStorage();
    return { driver: s.name, uploads: s.writable };
  } catch (err) {
    return { driver: "s3", uploads: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export const STORAGE_NOT_CONFIGURED =
  "Fayl saqlash sozlanmagan: Vercel’da fayllar Cloudflare R2 (yoki boshqa S3) omborida saqlanadi. " +
  "Administrator S3_* sozlamalarini kiritishi kerak (docs/FAYL-SAQLASH.md).";

/** Kinds that arrive in one request to the app (not directly to storage). */
const SINGLE_REQUEST_KINDS: ReadonlySet<UploadKind> = new Set(["avatar", "submission"]);

export function uploadLimitBytes(kind: UploadKind) {
  const e = env();
  const mb =
    kind === "video" ? e.MAX_VIDEO_UPLOAD_MB : kind === "book" ? e.MAX_BOOK_UPLOAD_MB : e.MAX_IMAGE_UPLOAD_MB;
  const bytes = mb * 1024 * 1024;
  // Vercel accepts at most 4.5 MB per request body.
  return SINGLE_REQUEST_KINDS.has(kind) && isReadOnlyHost() ? Math.min(bytes, SERVERLESS_MAX_RESPONSE) : bytes;
}

/** Streams an upload request body into storage for the given kind. */
export async function storeUpload(kind: UploadKind, body: ReadableStream<Uint8Array> | null) {
  if (!body) throw new UploadError("Fayl yuborilmadi", 400);
  const storage = getStorage();
  if (!storage.writable) {
    body.cancel().catch(() => {});
    throw new UploadError(STORAGE_NOT_CONFIGURED, 503);
  }
  const cfg = UPLOAD_KINDS[kind];
  return storage.putStream(cfg.area, body, {
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
