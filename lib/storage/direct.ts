import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { detectFileType, UPLOAD_KINDS, type UploadKind } from "./file-types";
import { getStorage, mimeForKey, uploadLimitBytes, UploadError, STORAGE_NOT_CONFIGURED, type StoredFile } from "./index";
import { newStorageKey, type StorageArea } from "./keys";

/**
 * Direct uploads: the browser sends the file straight to the bucket (never through a Vercel
 * function, which accepts only 4.5 MB). Flow:
 *   init     → server picks the key, returns presigned URL(s) + a signed token
 *   (browser PUTs the file / its parts to the bucket)
 *   complete → server finishes the multipart upload, checks size and magic bytes, returns the key
 *   abort    → cancels (multipart parts are discarded)
 * The token is HMAC-signed, so the browser cannot change key, kind, size or owner.
 */

/** Parts of 10 MiB: R2/S3 require ≥ 5 MiB per part (except the last) and equal sizes on R2. */
export const PART_SIZE = 10 * 1024 * 1024;
const URL_TTL_SECONDS = 6 * 60 * 60;

const EXT_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const EXT_ALIASES: Record<string, string> = { jpeg: "jpg", m4v: "mp4" };

type TokenPayload = { key: string; kind: UploadKind; size: number; uid: string; uploadId?: string; parts?: number; exp: number };

function secret() {
  return `direct-upload:${env().BETTER_AUTH_SECRET}`;
}

export function signToken(payload: TokenPayload, key = secret()) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${createHmac("sha256", key).update(body).digest("base64url")}`;
}

export function verifyToken(token: unknown, uid: string, key = secret(), now = Date.now()): TokenPayload {
  if (typeof token !== "string" || !token.includes(".")) throw new UploadError("Yuklash tokeni noto‘g‘ri", 400);
  const [body, mac] = token.split(".") as [string, string];
  const expected = createHmac("sha256", key).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new UploadError("Yuklash tokeni noto‘g‘ri", 400);
  const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenPayload;
  if (payload.uid !== uid) throw new UploadError("Yuklash tokeni boshqa foydalanuvchiga tegishli", 403);
  if (payload.exp < now) throw new UploadError("Yuklash muddati tugadi — faylni qayta tanlang", 400);
  return payload;
}

/** The type the file claims (from its name and the browser); the real type is checked on completion. */
function declaredMime(kind: UploadKind, fileName: string, browserType: string) {
  const allowed = UPLOAD_KINDS[kind].mimes as readonly string[];
  if (allowed.includes(browserType)) return browserType;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const normalized = EXT_ALIASES[ext] ?? ext;
  const byExt = Object.entries(EXT_BY_MIME).find(([, e]) => e === normalized)?.[0];
  if (byExt && allowed.includes(byExt)) return byExt;
  throw new UploadError(`Fayl turi qo‘llab-quvvatlanmaydi. Ruxsat: ${allowed.map((m) => EXT_BY_MIME[m]).join(", ")}`, 415);
}

export type DirectUploadPlan =
  | { mode: "proxy" }
  | { mode: "single"; token: string; url: string; contentType: string }
  | { mode: "multipart"; token: string; partSize: number; urls: string[] };

export async function startUpload(input: { kind: UploadKind; size: number; name: string; type: string }, uid: string): Promise<DirectUploadPlan> {
  const storage = getStorage();
  if (!storage.s3) {
    // Local disk (development / Docker): the file is streamed through the app as before.
    if (!storage.writable) throw new UploadError(STORAGE_NOT_CONFIGURED, 503);
    return { mode: "proxy" };
  }
  const limit = uploadLimitBytes(input.kind);
  if (!Number.isSafeInteger(input.size) || input.size <= 0) throw new UploadError("Fayl bo‘sh", 400);
  if (input.size > limit) throw new UploadError(`Fayl hajmi ${Math.round(limit / 1024 / 1024)} MB dan oshmasin`, 413);
  const contentType = declaredMime(input.kind, input.name, input.type);
  const key = newStorageKey(UPLOAD_KINDS[input.kind].area as StorageArea, EXT_BY_MIME[contentType]!);
  const exp = Date.now() + URL_TTL_SECONDS * 1000;

  if (input.size <= PART_SIZE) {
    return {
      mode: "single",
      token: signToken({ key, kind: input.kind, size: input.size, uid, exp }),
      url: storage.s3.presignPut(key, contentType, URL_TTL_SECONDS),
      contentType,
    };
  }
  const parts = Math.ceil(input.size / PART_SIZE);
  if (parts > 10_000) throw new UploadError("Fayl juda katta", 413);
  const uploadId = await storage.s3.createMultipartUpload(key, contentType);
  const urls = Array.from({ length: parts }, (_, i) => storage.s3!.presignPart(key, uploadId, i + 1, URL_TTL_SECONDS));
  return { mode: "multipart", token: signToken({ key, kind: input.kind, size: input.size, uid, uploadId, parts, exp }), partSize: PART_SIZE, urls };
}

export async function completeUpload(token: unknown, uid: string, etags: unknown): Promise<StoredFile> {
  const t = verifyToken(token, uid);
  const s3 = getStorage().s3;
  if (!s3) throw new UploadError(STORAGE_NOT_CONFIGURED, 503);

  if (t.uploadId) {
    const list = Array.isArray(etags) ? etags : [];
    if (list.length !== t.parts || !list.every((e) => typeof e === "string" && e.length > 0 && e.length < 200)) {
      // Browsers can only read ETag when the bucket's CORS rules expose it.
      throw new UploadError("Bo‘laklar tasdiqlanmadi (ETag yo‘q). Bucket CORS’da ExposeHeaders: [\"ETag\"] bo‘lishi kerak.", 400);
    }
    await s3.completeMultipartUpload(
      t.key,
      t.uploadId,
      (list as string[]).map((etag, i) => ({ partNumber: i + 1, etag })),
    );
  }

  const head = await s3.head(t.key);
  if (!head) throw new UploadError("Fayl omborga yetib bormadi — qayta yuklang", 400);
  const reject = async (message: string, status: number) => {
    await s3.delete(t.key).catch(() => {});
    throw new UploadError(message, status);
  };
  if (head.size !== t.size) await reject("Fayl to‘liq yuklanmadi — qayta urinib ko‘ring", 400);

  // The real type, from the first bytes — the name and the browser's claim are never trusted.
  const first = new Uint8Array(await (await s3.get(t.key, { start: 0, end: 63 })).arrayBuffer());
  const detected = detectFileType(first);
  const allowed = UPLOAD_KINDS[t.kind].mimes as readonly string[];
  if (!detected || !allowed.includes(detected.mime) || detected.mime !== mimeForKey(t.key)) {
    await reject("Fayl mazmuni tanlangan turga mos emas (masalan, nomi .mp4, lekin video emas)", 415);
  }
  return { key: t.key, size: head.size, mime: detected!.mime };
}

export async function abortUpload(token: unknown, uid: string) {
  const t = verifyToken(token, uid);
  const s3 = getStorage().s3;
  if (!s3) return;
  if (t.uploadId) await s3.abortMultipartUpload(t.key, t.uploadId);
  else await s3.delete(t.key);
}
