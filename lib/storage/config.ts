/**
 * Reads the S3_* settings (Cloudflare R2, AWS S3 or any S3-compatible bucket).
 * No `server-only` import: `npm run doctor`, `npm run storage:check` and the env schema use it too.
 *
 * Common mistakes get a message that says how to fix them instead of a failed upload later:
 *  - the public r2.dev address instead of the S3 API address;
 *  - the bucket name pasted at the end of the endpoint (Cloudflare shows it that way) — accepted;
 *  - http:// (only a local emulator on this computer may use it).
 */
import type { S3Config } from "./s3";

export type S3ConfigResult = { ok: true; config: S3Config | null } | { ok: false; error: string };

const R2_HINT = "https://<ACCOUNT_ID>.r2.cloudflarestorage.com";
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** S3 bucket naming rules (3–63 characters: lowercase letters, digits, dots, hyphens). */
export function isValidBucketName(bucket: string) {
  return /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) && !bucket.includes("..") && !/^\d+\.\d+\.\d+\.\d+$/.test(bucket);
}

export function isR2Endpoint(endpoint: string) {
  try {
    return new URL(endpoint).hostname.endsWith(".r2.cloudflarestorage.com");
  } catch {
    return false;
  }
}

export function parseS3Config(source: Record<string, string | undefined> = process.env): S3ConfigResult {
  const endpoint = source.S3_ENDPOINT?.trim();
  const bucket = source.S3_BUCKET?.trim();
  const accessKeyId = source.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = source.S3_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return { ok: true, config: null };

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { ok: false, error: `S3_ENDPOINT to‘liq manzil bo‘lsin, masalan ${R2_HINT}` };
  }

  if (url.hostname.endsWith(".r2.dev")) {
    return {
      ok: false,
      error: `S3_ENDPOINT — bu bucket’ning ommaviy r2.dev manzili. Cloudflare → R2 → API tokens sahifasidagi S3 API manzilini kiriting: ${R2_HINT}`,
    };
  }
  const loopback = LOOPBACK.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    return { ok: false, error: `S3_ENDPOINT https:// bilan boshlansin (${R2_HINT})` };
  }
  if (url.username || url.password || url.search || url.hash) {
    return { ok: false, error: `S3_ENDPOINT da login, parol yoki ?… qismi bo‘lmasin (${R2_HINT})` };
  }

  if (!isValidBucketName(bucket)) {
    return { ok: false, error: "S3_BUCKET nomi noto‘g‘ri: 3–63 ta kichik harf, raqam, nuqta yoki chiziqcha (masalan auforex-media)" };
  }

  // Cloudflare shows the endpoint as …r2.cloudflarestorage.com/<bucket>: the bucket part is accepted.
  const pathPart = url.pathname.replace(/\/+$/, "");
  if (pathPart && pathPart !== `/${bucket}`) {
    return { ok: false, error: `S3_ENDPOINT oxirida yo‘l bo‘lmasin — faqat ${R2_HINT} (bucket nomi S3_BUCKET da)` };
  }

  if (accessKeyId.length < 8 || secretAccessKey.length < 16) {
    return { ok: false, error: "S3_ACCESS_KEY_ID yoki S3_SECRET_ACCESS_KEY juda qisqa — API tokenni qayta nusxalang" };
  }

  return {
    ok: true,
    config: {
      endpoint: url.origin,
      bucket,
      accessKeyId,
      secretAccessKey,
      region: source.S3_REGION?.trim() || "auto",
    },
  };
}
