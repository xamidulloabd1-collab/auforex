/**
 * Uploads a folder of lesson videos to Bunny Stream and adds them to the site as lessons — in order.
 * Run it on YOUR computer (the videos stay on your disk until they go straight to Bunny).
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
 *   BUNNY_LIBRARY_ID   Bunny → Stream → your library → API → "Video Library ID"
 *   BUNNY_API_KEY      same page → "API Key" (not the token authentication key)
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

  const prisma = process.env.DATABASE_URL ? createScriptPrisma() : null;
  if (!prisma) console.log("! DATABASE_URL yo‘q — saytda nima borligini tekshirmasdan faqat reja ko‘rsatiladi.\n");

  try {
    // ---- plan
    type Row = PlannedLesson & { duration: number | null; exists: boolean };
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
        list.push({ ...l, duration, exists });
        if (!exists) {
          todo++;
          todoBytes += l.size;
        }
      }
      rows.set(course, list);
      console.log(`\n▸ Kurs: ${course.title}${existing ? " (saytda bor — yetishmagan darslar qo‘shiladi)" : " (yangi — nashr qilinmagan holda yaratiladi)"}`);
      list.forEach((r, i) =>
        console.log(`   ${String(i + 1).padStart(2)}. ${r.title}  ·  ${mmss(r.duration)}  ·  ${mb(r.size)}${r.exists ? "  ✓ allaqachon bor" : ""}`),
      );
    }
    console.log(`\nJami: ${todo} ta yangi dars, ${mb(todoBytes)} yuklanadi.`);

    if (!values.yes) {
      console.log('\nBu faqat reja. Yuklash uchun oxiriga --yes qo‘shing:  npm run videos:import -- "<papka>" --yes');
      return;
    }
    if (!todo) return;
    if (!prisma) throw new Error("DATABASE_URL kerak (.env.import faylida).");
    const libraryId = process.env.BUNNY_LIBRARY_ID?.trim();
    const apiKey = process.env.BUNNY_API_KEY?.trim();
    if (!libraryId || !/^\d+$/.test(libraryId) || !apiKey) {
      throw new Error("BUNNY_LIBRARY_ID (raqam) va BUNNY_API_KEY kerak (.env.import faylida). Bunny → Stream → kutubxona → API.");
    }
    const bunny: Bunny = { base: (process.env.BUNNY_API_BASE || "https://video.bunnycdn.com").replace(/\/$/, ""), libraryId, apiKey };
    // Check the key before anything is created on the site.
    await bunnyJson(bunny, "GET", "/videos?page=1&itemsPerPage=1");

    const category = values.category
      ? await prisma.category.findFirst({ where: { kind: "COURSE", name: { equals: values.category, mode: "insensitive" } }, select: { id: true } })
      : null;
    if (values.category && !category) console.log(`! "${values.category}" kategoriyasi topilmadi — kategoriyasiz yaratiladi.`);

    // ---- upload
    const failed: string[] = [];
    let done = 0;
    for (const course of plan) {
      let dbCourse = await prisma.course.findFirst({ where: { title: { equals: course.title, mode: "insensitive" } }, select: { id: true } });
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
          select: { id: true },
        });
        console.log(`\n＋ Kurs yaratildi: ${course.title}`);
      }
      for (const [index, r] of rows.get(course)!.entries()) {
        if (r.exists) continue;
        const label = `[${done + failed.length + 1}/${todo}] ${course.title} — ${r.title}`;
        let guid: string | null = null;
        try {
          const created = await bunnyJson(bunny, "POST", "/videos", { title: `${course.title} — ${r.title}`.slice(0, 200) });
          guid = String(created.guid ?? "");
          if (!/^[0-9a-f-]{36}$/i.test(guid)) throw new Error("Bunny video ID qaytarmadi");
          const started = Date.now();
          let lastPrint = 0;
          await uploadToBunny(bunny, guid, r.file, r.size, (sent) => {
            if (Date.now() - lastPrint < 1000 && sent < r.size) return;
            lastPrint = Date.now();
            const speed = sent / Math.max(1, (Date.now() - started) / 1000);
            process.stdout.write(`\r${label}: ${Math.floor((sent / r.size) * 100)}% · ${mb(speed)}/s   `);
          });
          await prisma.lesson.create({
            data: {
              courseId: dbCourse.id,
              slug: await uniqueSlug(prisma, "lesson", r.title),
              title: r.title,
              // The position in the folder, so a lesson re-uploaded later still lands in its place.
              order: index + 1,
              durationSeconds: r.duration,
              videoSource: "EMBED",
              embedUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${guid.toLowerCase()}`,
              isPublished: true,
              publishedAt: new Date(),
            },
          });
          done++;
          process.stdout.write(`\r${label}: ✓ yuklandi va saytga qo‘shildi\n`);
        } catch (err) {
          if (err instanceof BunnyAuthError) throw err; // every other video would fail the same way
          failed.push(`${course.title} — ${r.title}`);
          process.stdout.write(`\r${label}: ✗ ${err instanceof Error ? err.message : String(err)}\n`);
          // Do not leave a half-uploaded video in Bunny; the next run uploads it again.
          if (guid) await bunnyJson(bunny, "DELETE", `/videos/${guid}`).catch(() => {});
        }
      }
    }

    console.log(`\n✓ ${done} ta dars qo‘shildi.${failed.length ? ` ✗ ${failed.length} tasi o‘tmadi — buyruqni qayta ishga tushiring, qolganlari davom etadi.` : ""}`);
    console.log("Keyingi qadam: Super admin → Kurslar → yangi kursni tekshirib, “Nashr qilingan”ni yoqing.");
    console.log("Bunny videolarni qayta ishlashi (encoding) bir necha daqiqa olishi mumkin.");
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
