/**
 * Uploads a folder of lesson videos and adds them to the site as lessons — in order. Destination:
 *   --to r2     the site's own object storage (Cloudflare R2 / S3, the same bucket the admin panel uploads to);
 *   --to bunny  Bunny Stream (lessons become Bunny embeds).
 * Without --to: Bunny when BUNNY_* is set, otherwise R2 when S3_* is set.
 * Run it on YOUR computer (the videos go straight from your disk to the storage).
 *
 *   npm run videos:import -- "D:\AU Forex darslar"          # plan only: shows what would be added
 *   npm run videos:import -- "D:\AU Forex darslar" --yes    # uploads and adds the lessons
 *
 * Folder layout
 *   D:\AU Forex darslar\
 *     01 Trading asoslari\            ← a course (folder name, without the number)
 *       01 - Trading nima.mp4         ← lesson 1 "Trading nima"
 *       02 - Bozor turlari.mp4        ← lesson 2 …
 *     02 Texnik tahlil\ …
 *   A folder with videos directly inside is one course named after the folder (or --course "Nom").
 *
 * Settings (in a file named .env.import next to package.json — never share it):
 *   DATABASE_URL       the site's database (Vercel → Storage → your database → .env.local tab)
 *   R2: S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (same values as on Vercel; docs/FAYL-SAQLASH.md)
 *   Bunny: BUNNY_LIBRARY_ID (Stream → library → API → "Video Library ID") and BUNNY_API_KEY ("API Key")
 * R2 accepts MP4 (H.264/AAC) and WebM — the formats browsers play; convert other files first.
 *
 * Safe to run again: lessons that already exist (same title in the same course) are skipped,
 * so an interrupted upload continues where it stopped. New courses are created UNPUBLISHED —
 * check them in Super admin (admins see drafts), then switch the course to "Nashr qilingan".
 */
import { createReadStream, existsSync } from "node:fs";
import { open, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { parseArgs } from "node:util";
import { createScriptPrisma, type ScriptPrisma } from "../prisma/seed-helpers";
import { slugify } from "../lib/utils";
import { parseS3Config } from "../lib/storage/config";
import { detectFileType } from "../lib/storage/file-types";
import { newStorageKey } from "../lib/storage/keys";
import { S3Client } from "../lib/storage/s3";

export const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi"]);

/* ------------------------------------------------------------------ names and order */

const collator = new Intl.Collator("uz", { numeric: true, sensitivity: "base" });

/** "01 - Trading nima" → "Trading nima"; numbers only at the start are treated as order. */
export function cleanTitle(stem: string) {
  const cleaned = stem
    .replace(/[_]+/g, " ")
    .replace(/^\s*\d+\s*(?:[-–—.)\]:]+\s*|\s+)/, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || stem.trim();
}

export type PlannedLesson = { file: string; title: string; size: number };
export type PlannedCourse = { title: string; dir: string; lessons: PlannedLesson[] };

async function videosIn(dir: string): Promise<PlannedLesson[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && VIDEO_EXTENSIONS.has(path.extname(e.name).toLowerCase()) && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort(collator.compare);
  return Promise.all(
    files.map(async (name, i) => {
      const file = path.join(dir, name);
      let title = cleanTitle(path.basename(name, path.extname(name)));
      if (title.length < 3) title = `${i + 1}-dars`;
      return { file, title: title.slice(0, 160), size: (await stat(file)).size };
    }),
  );
}

/** Reads the folder: sub-folders are courses; videos directly inside form one course. */
export async function planFolder(root: string, courseName?: string): Promise<PlannedCourse[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const subdirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name).sort(collator.compare);
  const courses: PlannedCourse[] = [];
  const direct = await videosIn(root);
  if (direct.length) courses.push({ title: courseName?.trim() || cleanTitle(path.basename(path.resolve(root))), dir: root, lessons: direct });
  for (const name of subdirs) {
    const dir = path.join(root, name);
    const lessons = await videosIn(dir);
    if (lessons.length) courses.push({ title: cleanTitle(name), dir, lessons });
  }
  return courses;
}

/* ------------------------------------------------------------------ video length (MP4 / MOV) */

/** Duration in seconds from the MP4/MOV "mvhd" box, without loading the file; null if unknown. */
export async function mp4DurationSeconds(file: string): Promise<number | null> {
  const fh = await open(file, "r");
  try {
    const size = (await fh.stat()).size;
    const head = Buffer.alloc(16);
    const readBox = async (pos: number) => {
      const { bytesRead } = await fh.read(head, 0, 16, pos);
      if (bytesRead < 8) return null;
      let len = head.readUInt32BE(0);
      const type = head.toString("latin1", 4, 8);
      let header = 8;
      if (len === 1) {
        len = Number(head.readBigUInt64BE(8));
        header = 16;
      } else if (len === 0) {
        len = size - pos;
      }
      return len >= header ? { len, type, header } : null;
    };
    for (let pos = 0; pos < size; ) {
      const box = await readBox(pos);
      if (!box) return null;
      if (box.type === "moov") {
        const end = pos + box.len;
        for (let p = pos + box.header; p < end; ) {
          const child = await readBox(p);
          if (!child) return null;
          if (child.type === "mvhd") {
            const body = Buffer.alloc(32);
            await fh.read(body, 0, 32, p + child.header);
            const version = body[0];
            const timescale = version === 1 ? body.readUInt32BE(20) : body.readUInt32BE(12);
            const duration = version === 1 ? Number(body.readBigUInt64BE(24)) : body.readUInt32BE(16);
            return timescale ? Math.round(duration / timescale) : null;
          }
          p += child.len;
        }
        return null;
      }
      pos += box.len;
    }
    return null;
  } catch {
    return null;
  } finally {
    await fh.close();
  }
}

/* ------------------------------------------------------------------ Bunny Stream API */

type Bunny = { base: string; libraryId: string; apiKey: string };

async function bunnyJson(b: Bunny, method: string, pathname: string, body?: unknown) {
  const res = await fetch(`${b.base}/library/${b.libraryId}${pathname}`, {
    method,
    headers: { AccessKey: b.apiKey, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (res.status === 401 || res.status === 403) throw new BunnyAuthError();
  if (!res.ok) throw new Error(`Bunny ${method} ${pathname}: ${res.status} ${text.slice(0, 200)}`);
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

class BunnyAuthError extends Error {
  constructor() {
    super("Bunny kalitni qabul qilmadi: BUNNY_API_KEY yoki BUNNY_LIBRARY_ID noto‘g‘ri (Bunny → Stream → kutubxona → API).");
  }
}

async function uploadToBunny(b: Bunny, guid: string, file: string, size: number, onProgress: (sent: number) => void) {
  let sent = 0;
  const source = createReadStream(file, { highWaterMark: 1 << 20 });
  source.on("data", (chunk) => {
    sent += chunk.length;
    onProgress(sent);
  });
  const res = await fetch(`${b.base}/library/${b.libraryId}/videos/${guid}`, {
    method: "PUT",
    headers: { AccessKey: b.apiKey, "content-type": "application/octet-stream", "content-length": String(size) },
    body: Readable.toWeb(source) as ReadableStream<Uint8Array>,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  const text = await res.text();
  if (!res.ok) throw new Error(`Bunny yuklash: ${res.status} ${text.slice(0, 200)}`);
}

/* ------------------------------------------------------------------ R2 / S3 (the site's own storage) */

/** Formats a browser plays, as the admin panel accepts them; anything else must be converted first. */
export const R2_VIDEO_TYPES: Record<string, { mime: "video/mp4" | "video/webm"; ext: "mp4" | "webm" }> = {
  ".mp4": { mime: "video/mp4", ext: "mp4" },
  ".m4v": { mime: "video/mp4", ext: "mp4" },
  ".webm": { mime: "video/webm", ext: "webm" },
};

/** Same part size as the admin panel (R2 needs equal parts of at least 5 MiB, except the last). */
export const IMPORT_PART_SIZE = 10 * 1024 * 1024;
const PARALLEL_PARTS = 4;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The real type from the first bytes (the extension is never trusted); null when not MP4/WebM. */
export async function sniffVideo(file: string) {
  const fh = await open(file, "r");
  try {
    const head = Buffer.alloc(64);
    const { bytesRead } = await fh.read(head, 0, 64, 0);
    const detected = detectFileType(head.subarray(0, bytesRead));
    return detected && (detected.mime === "video/mp4" || detected.mime === "video/webm") ? detected : null;
  } finally {
    await fh.close();
  }
}

/** PUT one part through a presigned URL, retrying network errors, 5xx and 429; returns its ETag. */
async function putPart(url: string, body: Buffer, label: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { method: "PUT", body: new Uint8Array(body) });
      if (res.ok) {
        const etag = res.headers.get("etag");
        if (!etag) throw Object.assign(new Error(`${label}: ombor ETag qaytarmadi`), { final: true });
        return etag;
      }
      const text = await res.text().catch(() => "");
      if (res.status < 500 && res.status !== 429) throw Object.assign(new Error(`${label}: ${res.status} ${text.slice(0, 160)}`), { final: true });
      if (attempt >= 4) throw new Error(`${label}: ombor javob bermadi (${res.status})`);
    } catch (err) {
      if ((err as { final?: boolean }).final || attempt >= 4) throw err;
    }
    await sleep(1000 * 2 ** (attempt - 1));
  }
}

/** Uploads one video into the bucket under a new private key (multipart above 10 MiB) and returns the key. */
export async function uploadToS3(s3: S3Client, file: string, size: number, type: { mime: string; ext: "mp4" | "webm" }, onProgress: (sent: number) => void) {
  const key = newStorageKey("videos", type.ext);
  if (size <= IMPORT_PART_SIZE) {
    const fh = await open(file, "r");
    try {
      const data = Buffer.alloc(size);
      await fh.read(data, 0, size, 0);
      await s3.put(key, data, type.mime);
    } finally {
      await fh.close();
    }
    onProgress(size);
    return key;
  }
  const uploadId = await s3.createMultipartUpload(key, type.mime);
  const parts = Math.ceil(size / IMPORT_PART_SIZE);
  const etags: string[] = new Array(parts);
  const sent = new Array<number>(parts).fill(0);
  const fh = await open(file, "r");
  try {
    let next = 0;
    const worker = async () => {
      while (next < parts) {
        const i = next++;
        const length = Math.min(IMPORT_PART_SIZE, size - i * IMPORT_PART_SIZE);
        const body = Buffer.alloc(length);
        await fh.read(body, 0, length, i * IMPORT_PART_SIZE);
        etags[i] = await putPart(s3.presignPart(key, uploadId, i + 1, 6 * 60 * 60), body, `${i + 1}-bo‘lak`);
        sent[i] = length;
        onProgress(sent.reduce((a, b) => a + b, 0));
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL_PARTS, parts) }, worker));
    await s3.completeMultipartUpload(key, uploadId, etags.map((etag, i) => ({ partNumber: i + 1, etag })));
    return key;
  } catch (err) {
    // Never leave a half-uploaded video in the bucket; the next run uploads it again.
    await s3.abortMultipartUpload(key, uploadId).catch(() => {});
    throw err;
  } finally {
    await fh.close();
  }
}

/** Bunny when its keys are set, otherwise the site's R2/S3 storage when S3_* is set. */
export function pickDestination(requested: string | undefined, source: Record<string, string | undefined>): "bunny" | "r2" | null {
  if (requested === "bunny" || requested === "r2") return requested;
  if (requested) throw new Error(`--to faqat "r2" yoki "bunny" bo‘ladi (berilgan: ${requested})`);
  if (source.BUNNY_LIBRARY_ID?.trim() && source.BUNNY_API_KEY?.trim()) return "bunny";
  if (source.S3_ENDPOINT?.trim() && source.S3_BUCKET?.trim()) return "r2";
  return null;
}

/* ------------------------------------------------------------------ database */

async function uniqueSlug(prisma: ScriptPrisma, model: "course" | "lesson", title: string) {
  const base = slugify(title) || `${model}-${Date.now().toString(36)}`;
  for (let i = 1; i < 500; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    const found =
      model === "course"
        ? await prisma.course.findUnique({ where: { slug: candidate }, select: { id: true } })
        : await prisma.lesson.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!found) return candidate;
  }
  throw new Error(`Slug yaratib bo‘lmadi: ${title}`);
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n < 100 * 1024 * 1024 ? 1 : 0)} MB`;
const mmss = (s: number | null) => (s == null ? "—" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

/* ------------------------------------------------------------------ main */

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      yes: { type: "boolean", default: false },
      course: { type: "string" },
      category: { type: "string" },
      to: { type: "string" },
    },
    allowPositionals: true,
  });
  const envFile = path.join(process.cwd(), ".env.import");
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const root = positionals[0];
  if (!root || !existsSync(root) || !(await stat(root)).isDirectory()) {
    console.error('Videolar papkasini ko‘rsating:  npm run videos:import -- "D:\\AU Forex darslar"');
    process.exit(1);
  }

  const plan = await planFolder(root, values.course);
  if (!plan.length) {
    console.error(`"${root}" ichida video topilmadi (${[...VIDEO_EXTENSIONS].join(", ")}).`);
    process.exit(1);
  }

  const destination = pickDestination(values.to, process.env);
  console.log(
    destination === "r2"
      ? "Manzil: saytning R2/S3 ombori (S3_*)"
      : destination === "bunny"
        ? "Manzil: Bunny Stream"
        : "Manzil hali tanlanmagan (.env.import da S3_* yoki BUNNY_* yo‘q) — faqat reja",
  );

  const prisma = process.env.DATABASE_URL ? createScriptPrisma() : null;
  if (!prisma) console.log("! DATABASE_URL yo‘q — saytda nima borligini tekshirmasdan faqat reja ko‘rsatiladi.\n");

  try {
    // ---- plan
    type Row = PlannedLesson & { duration: number | null; exists: boolean; unsupported: boolean };
    const rows = new Map<PlannedCourse, Row[]>();
    let todo = 0;
    let todoBytes = 0;
    for (const course of plan) {
      const existing = prisma
        ? await prisma.course.findFirst({
            where: { title: { equals: course.title, mode: "insensitive" } },
            select: { lessons: { select: { title: true } } },
          })
        : null;
      const taken = new Set((existing?.lessons ?? []).map((l) => l.title.toLowerCase()));
      const list: Row[] = [];
      for (const l of course.lessons) {
        const exists = taken.has(l.title.toLowerCase());
        const ext = path.extname(l.file).toLowerCase();
        const duration = [".mp4", ".mov", ".m4v"].includes(ext) ? await mp4DurationSeconds(l.file) : null;
        // The site plays MP4 and WebM in the browser; other containers must be converted for R2.
        const unsupported = destination === "r2" && !exists && !R2_VIDEO_TYPES[ext];
        list.push({ ...l, duration, exists, unsupported });
        if (!exists && !unsupported) {
          todo++;
          todoBytes += l.size;
        }
      }
      rows.set(course, list);
      console.log(`\n▸ Kurs: ${course.title}${existing ? " (saytda bor — yetishmagan darslar qo‘shiladi)" : " (yangi — nashr qilinmagan holda yaratiladi)"}`);
      list.forEach((r, i) =>
        console.log(
          `   ${String(i + 1).padStart(2)}. ${r.title}  ·  ${mmss(r.duration)}  ·  ${mb(r.size)}${r.exists ? "  ✓ allaqachon bor" : ""}${
            r.unsupported ? "  ✗ MP4/WebM emas — o‘tkazib yuboriladi (avval MP4 ga o‘tkazing)" : ""
          }`,
        ),
      );
    }
    console.log(`\nJami: ${todo} ta yangi dars, ${mb(todoBytes)} yuklanadi.`);

    if (!values.yes) {
      console.log('\nBu faqat reja. Yuklash uchun oxiriga --yes qo‘shing:  npm run videos:import -- "<papka>" --yes');
      return;
    }
    if (!todo) return;
    if (!prisma) throw new Error("DATABASE_URL kerak (.env.import faylida).");
    if (!destination) throw new Error("Yuklash manzili yo‘q: .env.import ga S3_* (R2) yoki BUNNY_* qo‘shing, yoki --to r2|bunny bering.");

    let bunny: Bunny | null = null;
    let s3: S3Client | null = null;
    const libraryId = process.env.BUNNY_LIBRARY_ID?.trim() ?? "";
    if (destination === "bunny") {
      const apiKey = process.env.BUNNY_API_KEY?.trim();
      if (!libraryId || !/^\d+$/.test(libraryId) || !apiKey) {
        throw new Error("BUNNY_LIBRARY_ID (raqam) va BUNNY_API_KEY kerak (.env.import faylida). Bunny → Stream → kutubxona → API.");
      }
      bunny = { base: (process.env.BUNNY_API_BASE || "https://video.bunnycdn.com").replace(/\/$/, ""), libraryId, apiKey };
      // Check the key before anything is created on the site.
      await bunnyJson(bunny, "GET", "/videos?page=1&itemsPerPage=1");
    } else {
      const parsed = parseS3Config(process.env);
      if (!parsed.ok) throw new Error(parsed.error);
      if (!parsed.config) throw new Error("S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY kerak (.env.import faylida, Vercel’dagi qiymatlar).");
      s3 = new S3Client(parsed.config);
      // Check the keys before anything is created on the site (a missing object answers 404 → null).
      await s3.head(`videos/${"0".repeat(32)}.mp4`).catch((err) => {
        throw new Error(`Omborga ulanib bo‘lmadi (${err?.status ?? ""} ${err?.code ?? err?.message}) — S3_* qiymatlarini tekshiring`);
      });
    }

    const category = values.category
      ? await prisma.category.findFirst({ where: { kind: "COURSE", name: { equals: values.category, mode: "insensitive" } }, select: { id: true } })
      : null;
    if (values.category && !category) console.log(`! "${values.category}" kategoriyasi topilmadi — kategoriyasiz yaratiladi.`);

    // ---- upload
    const failed: string[] = [];
    let done = 0;
    for (const course of plan) {
      let dbCourse = await prisma.course.findFirst({ where: { title: { equals: course.title, mode: "insensitive" } }, select: { id: true, categoryId: true } });
      if (!dbCourse) {
        const last = await prisma.course.aggregate({ _max: { order: true } });
        dbCourse = await prisma.course.create({
          data: {
            title: course.title,
            slug: await uniqueSlug(prisma, "course", course.title),
            order: (last._max.order ?? 0) + 1,
            isPublished: false,
            categoryId: category?.id ?? null,
          },
          select: { id: true, categoryId: true },
        });
        console.log(`\n＋ Kurs yaratildi: ${course.title}`);
      }
      for (const [index, r] of rows.get(course)!.entries()) {
        if (r.exists || r.unsupported) continue;
        const label = `[${done + failed.length + 1}/${todo}] ${course.title} — ${r.title}`;
        let guid: string | null = null;
        let videoKey: string | null = null;
        try {
          const started = Date.now();
          let lastPrint = 0;
          const progress = (sent: number) => {
            if (Date.now() - lastPrint < 1000 && sent < r.size) return;
            lastPrint = Date.now();
            const speed = sent / Math.max(1, (Date.now() - started) / 1000);
            process.stdout.write(`\r${label}: ${Math.floor((sent / r.size) * 100)}% · ${mb(speed)}/s   `);
          };
          let videoData: { videoSource: "EMBED"; embedUrl: string } | { videoSource: "UPLOAD"; videoKey: string; videoMime: string; videoSize: bigint };
          if (bunny) {
            const created = await bunnyJson(bunny, "POST", "/videos", { title: `${course.title} — ${r.title}`.slice(0, 200) });
            guid = String(created.guid ?? "");
            if (!/^[0-9a-f-]{36}$/i.test(guid)) throw new Error("Bunny video ID qaytarmadi");
            await uploadToBunny(bunny, guid, r.file, r.size, progress);
            videoData = { videoSource: "EMBED", embedUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${guid.toLowerCase()}` };
          } else {
            const type = R2_VIDEO_TYPES[path.extname(r.file).toLowerCase()]!;
            const sniffed = await sniffVideo(r.file);
            if (!sniffed || sniffed.mime !== type.mime) throw new Error("fayl mazmuni MP4/WebM emas (kengaytmasi boshqacha bo‘lishi mumkin)");
            videoKey = await uploadToS3(s3!, r.file, r.size, type, progress);
            const stored = await s3!.head(videoKey);
            if (!stored || stored.size !== r.size) throw new Error(`omborda hajm mos emas (${stored?.size ?? 0} / ${r.size})`);
            videoData = { videoSource: "UPLOAD", videoKey, videoMime: type.mime, videoSize: BigInt(r.size) };
          }
          // The position in the folder, so a lesson re-uploaded later still lands in its place —
          // unless that number is already taken in this course (numbers are unique per course).
          let order = index + 1;
          if (await prisma.lesson.findFirst({ where: { courseId: dbCourse.id, order }, select: { id: true } })) {
            const last = await prisma.lesson.aggregate({ where: { courseId: dbCourse.id }, _max: { order: true } });
            order = (last._max.order ?? 0) + 1;
            console.log(`\n   ! ${index + 1}-dars raqami band — ${order}-dars sifatida qo‘shiladi`);
          }
          await prisma.lesson.create({
            data: {
              courseId: dbCourse.id,
              categoryId: category?.id ?? dbCourse.categoryId ?? null,
              slug: await uniqueSlug(prisma, "lesson", r.title),
              title: r.title,
              order,
              durationSeconds: r.duration,
              ...videoData,
              isPublished: true,
              publishedAt: new Date(),
            },
          });
          videoKey = null; // saved with the lesson
          done++;
          process.stdout.write(`\r${label}: ✓ yuklandi va saytga qo‘shildi\n`);
        } catch (err) {
          if (err instanceof BunnyAuthError) throw err; // every other video would fail the same way
          failed.push(`${course.title} — ${r.title}`);
          process.stdout.write(`\r${label}: ✗ ${err instanceof Error ? err.message : String(err)}\n`);
          // Do not leave a half-uploaded video behind; the next run uploads it again.
          if (guid && bunny) await bunnyJson(bunny, "DELETE", `/videos/${guid}`).catch(() => {});
          if (videoKey && s3) await s3.delete(videoKey).catch(() => {});
        }
      }
    }

    console.log(`\n✓ ${done} ta dars qo‘shildi.${failed.length ? ` ✗ ${failed.length} tasi o‘tmadi — buyruqni qayta ishga tushiring, qolganlari davom etadi.` : ""}`);
    console.log("Keyingi qadam: Super admin → Kurslar → yangi kursni tekshirib, “Nashr qilingan”ni yoqing.");
    if (bunny) console.log("Bunny videolarni qayta ishlashi (encoding) bir necha daqiqa olishi mumkin.");
    if (failed.length) process.exitCode = 1;
  } finally {
    await prisma?.$disconnect();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "import-videos.ts"))) {
  main().catch((err) => {
    console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
