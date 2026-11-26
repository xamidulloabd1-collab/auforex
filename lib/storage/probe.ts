/**
 * Live check of the object-storage bucket (Cloudflare R2 / S3) with the configured keys:
 *   1. write, read back and delete a tiny test object (keys, bucket name, permissions);
 *   2. the CORS preflight a browser sends before uploading (site origin, PUT, Content-Type);
 *   3. that the upload answer exposes ETag to the page (needed for large videos sent in parts);
 *   4. starting and cancelling a multipart upload.
 * Used by `npm run storage:check` and Super admin → Sozlamalar → Tizim. Never prints keys.
 * No `server-only` import so the CLI can use it.
 */
import { randomUUID } from "node:crypto";
import { S3Client, S3Error, type S3Config } from "./s3";

export type ProbeStep = { name: string; ok: boolean; detail?: string };

const TEST_PREFIX = "_healthcheck";

function describe(err: unknown) {
  if (err instanceof S3Error) {
    if (err.status === 403 || err.code === "SignatureDoesNotMatch" || err.code === "InvalidAccessKeyId") {
      return "kalitlar noto‘g‘ri yoki tokenda shu bucket uchun “Object Read & Write” huquqi yo‘q";
    }
    if (err.code === "NoSuchBucket") return "bunday bucket yo‘q — S3_BUCKET nomini Cloudflare’dagi bilan solishtiring";
    if (err.code === "Timeout" || err.code === "NetworkError") return `ombor manziliga ulanib bo‘lmadi (${err.message}) — S3_ENDPOINT ni tekshiring`;
    return `${err.status} ${err.code}`;
  }
  return err instanceof Error ? err.message : String(err);
}

async function withTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

export async function probeStorage(config: S3Config, siteOrigin: string): Promise<ProbeStep[]> {
  const s3 = new S3Client(config);
  const steps: ProbeStep[] = [];
  const key = `${TEST_PREFIX}/${randomUUID()}.txt`;
  const payload = new TextEncoder().encode(`AU Forex Academy storage check ${new Date().toISOString()}`);

  // 1. Keys and permissions -------------------------------------------------------------------
  let written = false;
  try {
    await s3.put(key, payload, "text/plain");
    written = true;
    const head = await s3.head(key);
    if (!head || head.size !== payload.length) throw new Error("yozilgan fayl topilmadi yoki hajmi boshqa");
    const back = new Uint8Array(await (await s3.get(key)).arrayBuffer());
    if (Buffer.compare(Buffer.from(back), Buffer.from(payload)) !== 0) throw new Error("o‘qilgan mazmun yozilganiga mos emas");
    steps.push({ name: "Kalitlar va bucket: yozish, o‘qish", ok: true });
  } catch (err) {
    steps.push({ name: "Kalitlar va bucket: yozish, o‘qish", ok: false, detail: describe(err) });
  } finally {
    if (written) {
      try {
        await s3.delete(key);
        steps.push({ name: "Test faylini o‘chirish", ok: true });
      } catch (err) {
        steps.push({ name: "Test faylini o‘chirish", ok: false, detail: describe(err) });
      }
    }
  }
  if (!written) return steps;

  // 2. CORS preflight, exactly as the browser sends it before a direct upload -----------------
  const putUrl = s3.presignPut(`${TEST_PREFIX}/${randomUUID()}.txt`, "text/plain", 300);
  try {
    const res = await withTimeout(putUrl, {
      method: "OPTIONS",
      headers: { Origin: siteOrigin, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type" },
    });
    const allowOrigin = res.headers.get("access-control-allow-origin");
    const allowMethods = (res.headers.get("access-control-allow-methods") ?? "").toUpperCase();
    const allowHeaders = (res.headers.get("access-control-allow-headers") ?? "").toLowerCase();
    const originOk = allowOrigin === "*" || allowOrigin === siteOrigin;
    const methodOk = allowMethods.includes("PUT");
    const headerOk = allowHeaders === "*" || allowHeaders.includes("content-type");
    const allowed = res.status >= 200 && res.status < 300;
    const ok = allowed && originOk && methodOk && headerOk;
    steps.push({
      name: `CORS: ${siteOrigin} dan yuklashga ruxsat`,
      ok,
      detail: ok
        ? undefined
        : !allowed || !originOk
          ? `bucket CORS qoidasi bu saytni rad etdi (javob: ${res.status}) — "AllowedOrigins": ["${siteOrigin}"], "AllowedMethods": ["GET","PUT","HEAD"], "AllowedHeaders": ["Content-Type","Range"] bo‘lsin`
          : !methodOk
            ? `"AllowedMethods" ichida "PUT" yo‘q`
            : `"AllowedHeaders" ichida "Content-Type" yo‘q`,
    });
  } catch (err) {
    steps.push({ name: `CORS: ${siteOrigin} dan yuklashga ruxsat`, ok: false, detail: describe(err) });
  }

  // 3. The real upload answer must let the page read ETag ---------------------------------------
  const etagKey = `${TEST_PREFIX}/${randomUUID()}.txt`;
  try {
    const res = await withTimeout(s3.presignPut(etagKey, "text/plain", 300), {
      method: "PUT",
      headers: { Origin: siteOrigin, "Content-Type": "text/plain" },
      body: payload,
    });
    const exposed = (res.headers.get("access-control-expose-headers") ?? "").toLowerCase();
    const ok = res.ok && (exposed === "*" || exposed.split(",").map((h) => h.trim()).includes("etag"));
    steps.push({
      name: "CORS: ETag sahifaga ko‘rinadi (katta videolar uchun)",
      ok,
      detail: ok ? undefined : res.ok ? `bucket CORS’ida "ExposeHeaders": ["ETag"] yo‘q` : `brauzerdan yuklash rad etildi (${res.status})`,
    });
  } catch (err) {
    steps.push({ name: "CORS: ETag sahifaga ko‘rinadi (katta videolar uchun)", ok: false, detail: describe(err) });
  } finally {
    await s3.delete(etagKey).catch(() => {});
  }

  // 4. Multipart uploads (videos over 10 MB) ----------------------------------------------------
  const mpKey = `${TEST_PREFIX}/${randomUUID()}.bin`;
  try {
    const uploadId = await s3.createMultipartUpload(mpKey, "application/octet-stream");
    await s3.abortMultipartUpload(mpKey, uploadId);
    steps.push({ name: "Bo‘laklab yuklash (multipart): boshlash va bekor qilish", ok: true });
  } catch (err) {
    steps.push({ name: "Bo‘laklab yuklash (multipart): boshlash va bekor qilish", ok: false, detail: describe(err) });
  }

  return steps;
}
