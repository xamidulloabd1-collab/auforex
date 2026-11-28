#!/usr/bin/env node
/**
 * Video lessons from a ZIP (or folder) onto the site — through the Super admin panel, so the site's
 * own storage keys and checks are used (no database or bucket keys on this computer).
 *
 *   node scripts/content-import.mjs plan    <archive.zip | folder> [--out content-import] [--free 1]
 *   node scripts/content-import.mjs plan    <archive.zip | folder> --meta meta.json   (one course, titles from meta)
 *   node scripts/content-import.mjs covers  [--out content-import] [--width 1920] [--pad-number]
 *   node scripts/content-import.mjs prepare [--out content-import] [--allow-transcode]
 *   node scripts/content-import.mjs import  --site https://… [--out content-import] [--publish-courses]
 *   node scripts/content-import.mjs verify  --site https://… [--out content-import]
 *   node scripts/content-import.mjs publish --site https://… [--out content-import]
 *
 * plan     unpacks the archive, reads every video (ffprobe), finds duplicates by content and writes
 *          plan.json + PLAN.md for approval: categories, courses, lesson numbers and titles, access,
 *          and what each file needs (upload as is / lossless remux / re-encode / skip).
 * --meta   a JSON file the owner approves: { course: {title, description, category},
 *          lessons: { "1": {title, category, description, level, access, topics[]} … } }. With it every
 *          video goes into that ONE course (numbers = order of the series) and each lesson gets its own
 *          category, title and description.
 * covers   draws a 16:9 cover for each lesson in the site's own style (logo, number, title, topics).
 * prepare  makes browser-ready copies: MP4 with the index at the start (lossless). Re-encoding to
 *          H.264/AAC only with --allow-transcode (it changes the video, so it is never automatic).
 * import   signs in as a super admin (IMPORT_ADMIN_EMAIL / IMPORT_ADMIN_PASSWORD) and creates the
 *          missing categories, courses and lessons with their videos. Safe to run again: lessons that
 *          already exist (same title or number in the course) are skipped; progress is kept in ledger.json.
 * verify   checks every planned lesson on the site: it exists once, and its video answers from storage.
 * publish  publishes the plan's courses (only after the content has been checked and approved).
 * update-covers  replaces the covers of lessons already on the site (after `covers` was run again).
 *
 * Folder layout in the archive (one top folder is unwrapped):
 *   <Kategoriya>/<01 Dars nomi>.mp4                 → course = category
 *   <Kategoriya>/<Kurs>/<01 Dars nomi>.mp4          → course inside the category
 * Numbers at the start of folder/file names give the order ("01 - …", "1-dars …", "Dars 3 …").
 * Needs ffmpeg/ffprobe and python3 (archive names in any encoding); import also needs Playwright's Chromium.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, createReadStream, existsSync, linkSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, openSync, readSync, closeSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

export const VIDEO_EXTENSIONS = new Set([".mp4", ".m4v", ".mov", ".mkv", ".webm", ".avi", ".wmv", ".flv", ".3gp", ".ts", ".mts"]);
const IGNORED = /^(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini)$/i;
const MAX_UPLOAD_BYTES = 2048 * 1024 * 1024; // MAX_VIDEO_UPLOAD_MB default on the site
const collator = new Intl.Collator("uz", { numeric: true, sensitivity: "base" });

/* ------------------------------------------------------------------ names and order (pure) */

/** Lesson/category number written in the name: "01 - …", "1-dars …", "Dars 3 …", "Lesson 03"; null if none. */
export function numberIn(raw) {
  const name = raw.replace(/_+/g, " ");
  const m =
    /^\s*(\d{1,4})(?!\d)/.exec(name) ??
    /(?:^|[\s_.-])(\d{1,4})\s*-?\s*dars\b/i.exec(name) ??
    /\b(?:dars|lesson|урок|qism|part)\s*[-_.]?\s*(\d{1,4})\b/i.exec(name);
  return m ? Number(m[1]) : null;
}

/** "01 - Trading nima" / "1-dars. Trading nima" / "Dars_02_Trend" → "Trading nima" / "Trend". */
export function cleanTitle(stem) {
  const s = stem
    .replace(/[_]+/g, " ")
    .replace(/^\s*\d{1,4}\s*-?\s*dars\b\s*[-–—.):]*\s*/i, "")
    .replace(/^\s*(?:dars|lesson|урок|qism|part)\s*[-.]?\s*\d{1,4}\s*[-–—.):]*\s*/i, "")
    .replace(/^\s*\d{1,4}\s*(?:[-–—.)\]:]+\s*|\s+)/, "")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

/** Sorts entries by their written number, then naturally; assigns 1..N when numbers are missing or repeat. */
export function orderEntries(names) {
  const sorted = [...names].sort((a, b) => {
    const na = numberIn(a);
    const nb = numberIn(b);
    if (na !== null && nb !== null && na !== nb) return na - nb;
    return collator.compare(a, b);
  });
  const written = sorted.map(numberIn);
  const usable = written.every((n) => n !== null && n > 0) && new Set(written).size === written.length;
  return sorted.map((name, i) => ({ name, number: usable ? written[i] : i + 1 }));
}

/** What a probed file needs before the browser can play it. */
export function decideAction(info) {
  if (!info || info.error) return { action: "skip", reason: `o‘qib bo‘lmadi${info?.error ? `: ${info.error}` : ""}` };
  const v = info.video;
  if (!v) return { action: "skip", reason: "video oqimi yo‘q" };
  const a = info.audio;
  const isWebm = /webm|matroska/.test(info.format) && ["vp8", "vp9", "av1"].includes(v) && (!a || ["opus", "vorbis"].includes(a));
  if (isWebm && info.ext === ".webm") return { action: "upload", reason: "WebM" };
  const h264 = v === "h264" && (!info.pixFmt || info.pixFmt === "yuv420p");
  const audioOk = !a || a === "aac" || a === "mp3";
  if (!h264 || !audioOk) {
    return { action: "transcode", reason: `kodek ${v}${a ? `/${a}` : ""}${info.pixFmt && info.pixFmt !== "yuv420p" ? ` ${info.pixFmt}` : ""} — brauzerlar uchun H.264/AAC ga o‘tkazish kerak` };
  }
  const mp4 = [".mp4", ".m4v"].includes(info.ext) && /mp4|mov/.test(info.format);
  if (mp4 && info.faststart) return { action: "upload", reason: "MP4 H.264/AAC" };
  return { action: "remux", reason: mp4 ? "indeks fayl oxirida — sifat o‘zgarmasdan boshiga ko‘chiriladi" : `${info.ext} → MP4 (sifat o‘zgarmaydi)` };
}

/** Marks every later file with the same content as a duplicate of the first one. */
export function markDuplicates(lessons) {
  const seen = new Map();
  for (const l of lessons) {
    if (!l.sha256) continue;
    const first = seen.get(l.sha256);
    if (first) Object.assign(l, { action: "skip", reason: `takror: “${first.category} / ${first.title}” bilan bir xil fayl` });
    else seen.set(l.sha256, l);
  }
  return lessons;
}

/* ------------------------------------------------------------------ files */

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
  if (r.error) throw r.error;
  return r;
}

/** Unpacks with Python's zipfile: UTF-8 names, legacy (cp437/cp866) names, no paths outside the folder. */
function unzip(archive, dest) {
  const code = `
import sys, zipfile, os
src, dest = sys.argv[1], os.path.realpath(sys.argv[2])
with zipfile.ZipFile(src) as z:
    for info in z.infolist():
        name = info.filename
        if not (info.flag_bits & 0x800):
            raw = name.encode("cp437")
            for enc in ("utf-8", "cp866", "cp1251"):
                try:
                    name = raw.decode(enc); break
                except UnicodeDecodeError:
                    pass
        target = os.path.realpath(os.path.join(dest, name))
        if not target.startswith(dest + os.sep):
            print("skip unsafe path:", name, file=sys.stderr); continue
        if name.endswith("/"):
            os.makedirs(target, exist_ok=True); continue
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with z.open(info) as fsrc, open(target, "wb") as fdst:
            while True:
                chunk = fsrc.read(1 << 20)
                if not chunk: break
                fdst.write(chunk)
`;
  mkdirSync(dest, { recursive: true });
  const r = run("python3", ["-I", "-c", code, archive, dest]);
  if (r.status !== 0) throw new Error(`Arxivni ochib bo‘lmadi: ${r.stderr.trim().slice(0, 300)}`);
}

function listDir(dir) {
  return readdirSync(dir, { withFileTypes: true }).filter((e) => !IGNORED.test(e.name) && !e.name.startsWith("."));
}

/** A single wrapping folder (common in archives) is unwrapped. */
function contentRoot(dir) {
  let root = dir;
  for (;;) {
    const entries = listDir(root);
    if (entries.length === 1 && entries[0].isDirectory()) root = path.join(root, entries[0].name);
    else return root;
  }
}

function videosIn(dir) {
  return listDir(dir)
    .filter((e) => e.isFile() && VIDEO_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
    .map((e) => e.name);
}

/** All video files below `dir` (deeper folders are flattened into one course, in path order). */
function videosBelow(dir, prefix = "") {
  const out = videosIn(dir).map((n) => path.join(prefix, n));
  for (const sub of orderEntries(listDir(dir).filter((e) => e.isDirectory()).map((e) => e.name))) {
    out.push(...videosBelow(path.join(dir, sub.name), path.join(prefix, sub.name)));
  }
  return out;
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(file).on("data", (c) => h.update(c)).on("end", () => resolve(h.digest("hex"))).on("error", reject);
  });
}

/** Top-level MP4/MOV boxes: is "moov" before "mdat" (the browser can start without reading the end)? */
function faststart(file) {
  const fd = openSync(file, "r");
  try {
    const size = statSync(file).size;
    const head = Buffer.alloc(16);
    for (let pos = 0; pos < size; ) {
      if (readSync(fd, head, 0, 16, pos) < 8) return false;
      let len = head.readUInt32BE(0);
      const type = head.toString("latin1", 4, 8);
      if (len === 1) len = Number(head.readBigUInt64BE(8));
      else if (len === 0) len = size - pos;
      if (type === "moov") return true;
      if (type === "mdat") return false;
      if (len < 8) return false;
      pos += len;
    }
    return false;
  } finally {
    closeSync(fd);
  }
}

function probe(file) {
  const r = run("ffprobe", ["-v", "error", "-show_entries", "format=format_name,duration:stream=codec_type,codec_name,width,height,pix_fmt", "-of", "json", file]);
  if (r.status !== 0) return { error: r.stderr.trim().split("\n")[0]?.slice(0, 160) || "ffprobe" };
  const j = JSON.parse(r.stdout);
  const v = j.streams?.find((s) => s.codec_type === "video" && s.codec_name !== "mjpeg" && s.codec_name !== "png");
  const a = j.streams?.find((s) => s.codec_type === "audio");
  const ext = path.extname(file).toLowerCase();
  return {
    ext,
    format: j.format?.format_name ?? "",
    duration: j.format?.duration ? Math.round(Number(j.format.duration)) : null,
    video: v?.codec_name ?? null,
    audio: a?.codec_name ?? null,
    pixFmt: v?.pix_fmt ?? null,
    width: v?.width ?? null,
    height: v?.height ?? null,
    faststart: [".mp4", ".m4v", ".mov"].includes(ext) ? faststart(file) : false,
  };
}

const LEVELS = { BEGINNER: "Boshlang‘ich", INTERMEDIATE: "O‘rta", ADVANCED: "Yuqori" };
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const mmss = (s) => (s == null ? "—" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

/** Opens an admin page and waits until it is interactive: input made before React hydrates is lost. */
async function open(page, url) {
  await page.goto(url);
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
}

/* ------------------------------------------------------------------ plan */

/** Puts every lesson into the single course of `meta` and applies the approved titles and texts. */
export function applyMeta(categories, meta) {
  const course = meta.course;
  const lessons = categories.flatMap((c) => c.courses.flatMap((k) => k.lessons));
  const byCategory = new Map();
  for (const l of lessons) {
    const m = meta.lessons?.[String(l.number)] ?? {};
    Object.assign(l, {
      course: course.title,
      category: m.category ?? course.category,
      ...(m.title ? { title: m.title } : {}),
      ...(m.coverTitle ? { coverTitle: m.coverTitle } : {}),
      ...(m.motif ? { motif: m.motif } : {}),
      ...(m.summary ? { summary: m.summary } : {}),
      description: m.description ?? l.description ?? null,
      level: m.level ?? l.level ?? null,
      access: m.access ?? l.access,
      topics: m.topics ?? [],
    });
    if (!byCategory.has(l.category)) byCategory.set(l.category, []);
    byCategory.get(l.category).push(l);
  }
  return [...byCategory.entries()].map(([name, list], i) => ({
    name,
    order: i + 1,
    courses: [{ title: course.title, description: course.description ?? null, category: course.category ?? null, publish: false, lessons: list }],
  }));
}

async function plan(source, out, freeCount, metaFile) {
  const srcDir = path.join(out, "source");
  let root;
  if (statSync(source).isDirectory()) root = contentRoot(path.resolve(source));
  else {
    console.log(`Arxiv ochilmoqda → ${srcDir}`);
    unzip(path.resolve(source), srcDir);
    root = contentRoot(srcDir);
  }

  /** @type {{ name: string, order: number, courses: { title: string, publish: boolean, lessons: any[] }[] }[]} */
  const categories = [];
  const loose = videosIn(root);
  if (loose.length) {
    const name = cleanTitle(path.basename(root)) || "Video darsliklar";
    categories.push({ name, order: 0, dir: root, courses: [{ title: name, dir: root, files: loose }] });
  }
  for (const cat of orderEntries(listDir(root).filter((e) => e.isDirectory()).map((e) => e.name))) {
    const catDir = path.join(root, cat.name);
    const name = cleanTitle(cat.name) || cat.name;
    const entry = { name, order: cat.number, courses: [] };
    const direct = videosIn(catDir);
    if (direct.length) entry.courses.push({ title: name, dir: catDir, files: direct });
    for (const course of orderEntries(listDir(catDir).filter((e) => e.isDirectory()).map((e) => e.name))) {
      const dir = path.join(catDir, course.name);
      const files = videosBelow(dir);
      if (files.length) entry.courses.push({ title: cleanTitle(course.name) || course.name, dir, files });
    }
    if (entry.courses.length) categories.push(entry);
  }
  if (!categories.length) throw new Error("Arxivda video fayl topilmadi");

  const all = [];
  for (const cat of categories) {
    for (const course of cat.courses) {
      const ordered = orderEntries(course.files);
      course.lessons = [];
      for (const { name, number } of ordered) {
        const file = path.join(course.dir, name);
        const stem = path.basename(name, path.extname(name));
        const info = probe(file);
        const size = statSync(file).size;
        const lesson = {
          category: cat.name,
          course: course.title,
          number,
          title: (cleanTitle(stem) || `${number}-dars`).slice(0, 160),
          file: path.relative(out, file),
          size,
          durationSeconds: info.duration ?? null,
          resolution: info.width ? `${info.width}x${info.height}` : null,
          codecs: info.video ? `${info.video}${info.audio ? `/${info.audio}` : ""}` : null,
          access: number <= freeCount ? "FREE" : "PRO",
          level: null,
          ...decideAction(info),
          sha256: await sha256(file),
        };
        if (lesson.action !== "skip" && size > MAX_UPLOAD_BYTES && lesson.action !== "transcode") {
          Object.assign(lesson, { action: "transcode", reason: `${mb(size)} — saytdagi 2 GB chegaradan katta, siqish kerak` });
        }
        course.lessons.push(lesson);
        all.push(lesson);
        process.stdout.write(`\r${all.length} ta video o‘qildi   `);
      }
      delete course.files;
      delete course.dir;
      course.publish = false;
    }
    delete cat.dir;
  }
  markDuplicates(all);
  if (metaFile) {
    const meta = JSON.parse(readFileSync(metaFile, "utf8"));
    if (!meta.course?.title) throw new Error("meta.json: course.title kerak");
    categories.splice(0, categories.length, ...applyMeta(categories, meta));
  }
  // Two files with the same title in one course would look like a repeated lesson: number them apart.
  for (const cat of categories) for (const course of cat.courses) {
    const titles = new Map();
    for (const l of course.lessons) titles.set(l.title.toLowerCase(), (titles.get(l.title.toLowerCase()) ?? 0) + 1);
    for (const l of course.lessons) if (titles.get(l.title.toLowerCase()) > 1) l.title = `${l.title} (${l.number})`;
  }

  const result = { version: 1, createdAt: new Date().toISOString(), source: path.basename(source), categories };
  writeFileSync(path.join(out, "plan.json"), JSON.stringify(result, null, 2));
  writeFileSync(path.join(out, "PLAN.md"), planMarkdown(result));
  console.log(`\n✓ ${path.join(out, "PLAN.md")} va plan.json tayyor — tasdiqlash uchun ko‘rib chiqing.`);
  printSummary(result);
}

function planMarkdown(p) {
  const all = p.categories.flatMap((c) => c.courses.flatMap((k) => k.lessons));
  const lines = [
    `# Video darsliklar importi — reja`,
    ``,
    `Manba: \`${p.source}\` · ${all.length} ta fayl · ${mb(all.reduce((s, l) => s + l.size, 0))} · tuzildi ${p.createdAt.slice(0, 16).replace("T", " ")} UTC`,
    ``,
    `Belgilar: **upload** — o‘zi yuklanadi · **remux** — sifat o‘zgarmasdan MP4 ga moslanadi · **transcode** — qayta kodlash kerak (ruxsat bilan) · **skip** — yuklanmaydi.`,
    `Kurslar avval **nashr qilinmagan** holda yaratiladi; tekshirilgach nashr qilinadi.`,
    ``,
  ];
  const courseTitles = new Set(p.categories.flatMap((c) => c.courses.map((k) => k.title)));
  if (courseTitles.size === 1 && p.categories.length > 1) {
    // One course (series) whose lessons have their own categories: one table in lesson order.
    const k = p.categories[0].courses[0];
    const lessons = p.categories.flatMap((c) => c.courses.flatMap((x) => x.lessons.map((l) => ({ ...l, category: c.name })))).sort((a, b) => a.number - b.number);
    lines.push(`## Kurs: ${k.title}`, "", ...(k.description ? [k.description, ""] : []), `Kurs kategoriyasi: ${k.category ?? p.categories[0].name}`, "");
    lines.push("| № | Dars nomi | Kategoriya | Daraja | Davomiyligi | Hajmi | Kirish | Holat | Fayl |", "|---|---|---|---|---|---|---|---|---|");
    for (const l of lessons) {
      lines.push(`| ${l.number} | ${l.title} | ${l.category} | ${LEVELS[l.level] ?? "—"} | ${mmss(l.durationSeconds)} | ${mb(l.size)} | ${l.access === "FREE" ? "Bepul" : "PRO"} | **${l.action}** ${l.reason} | \`${path.basename(l.file)}\` |`);
    }
    lines.push("");
    for (const l of lessons) {
      lines.push(`### ${l.number}-dars. ${l.title}`, "", ...(l.description ? [l.description, ""] : []), ...(l.topics?.length ? [`Mavzular: ${l.topics.join(" · ")}`, ""] : []), ...(l.cover ? [`Muqova: \`${l.cover}\``, ""] : []));
    }
    return lines.join("\n");
  }
  for (const c of p.categories) {
    lines.push(`## ${c.order}. ${c.name}`, "");
    for (const k of c.courses) {
      if (k.title !== c.name) lines.push(`### Kurs: ${k.title}${k.description ? ` — ${k.description}` : ""}`, "");
      lines.push("| № | Dars nomi | Davomiyligi | Hajmi | Kirish | Holat | Fayl |", "|---|---|---|---|---|---|---|");
      for (const l of k.lessons) {
        lines.push(`| ${l.number} | ${l.title} | ${mmss(l.durationSeconds)} | ${mb(l.size)} | ${l.access === "FREE" ? "Bepul" : "PRO"} | **${l.action}** ${l.reason} | \`${path.basename(l.file)}\` |`);
      }
      lines.push("");
      for (const l of k.lessons.filter((x) => x.description || x.cover)) {
        lines.push(`**${l.number}-dars. ${l.title}** · ${c.name}${l.level ? ` · ${LEVELS[l.level] ?? l.level}` : ""}`, "");
        if (l.description) lines.push(l.description, "");
        if (l.topics?.length) lines.push(`Mavzular: ${l.topics.join(" · ")}`, "");
        if (l.cover) lines.push(`Muqova: \`${l.cover}\``, "");
      }
    }
  }
  return lines.join("\n");
}

function printSummary(p) {
  const all = p.categories.flatMap((c) => c.courses.flatMap((k) => k.lessons));
  const by = (a) => all.filter((l) => l.action === a).length;
  console.log(`Kategoriyalar: ${p.categories.length} · kurslar: ${p.categories.reduce((s, c) => s + c.courses.length, 0)} · darslar: ${all.length}`);
  console.log(`upload ${by("upload")} · remux ${by("remux")} · transcode ${by("transcode")} · skip ${by("skip")} · jami ${mb(all.reduce((s, l) => s + l.size, 0))}`);
}

/* ------------------------------------------------------------------ covers */

const escapeHtml = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);

/** Small deterministic random generator, so a lesson's chart looks the same on every run. */
function seeded(n) {
  let x = (n * 2654435761) >>> 0 || 1;
  return () => ((x = (x ^ (x << 13)) >>> 0), (x = (x ^ (x >>> 17)) >>> 0), (x = (x ^ (x << 5)) >>> 0), x / 4294967296);
}

/** Candlestick chart in the site's colours (SVG). The lesson number picks the shape — uptrend,
 *  reversal, or range then breakout — and the exact candles, so neighbouring covers differ. */
export function candlesSvg(number, width = 640, height = 430) {
  const rnd = seeded(number * 97 + 13);
  const count = 24;
  const step = width / count;
  const shape = number % 3; // 1: uptrend · 2: down, then up · 0: range, then breakout
  const target = (i) => {
    const t = i / (count - 1);
    if (shape === 1) return 0.82 - t * 0.68;
    if (shape === 2) return t < 0.45 ? 0.35 + t * 1.0 : 0.8 - (t - 0.45) * 1.25;
    return t < 0.62 ? 0.62 + Math.sin(t * 18) * 0.07 : 0.62 - (t - 0.62) * 1.35;
  };
  let price = target(0) * height;
  const parts = [];
  const trend = [];
  for (let i = 0; i < count; i++) {
    const open = price;
    const goal = target(i) * height;
    const close = Math.min(height * 0.94, Math.max(height * 0.06, open + (goal - open) * 0.75 + (rnd() - 0.5) * height * 0.09));
    const high = Math.min(open, close) - (0.01 + rnd() * 0.05) * height;
    const low = Math.max(open, close) + (0.01 + rnd() * 0.05) * height;
    const up = close < open;
    const x = i * step + step * 0.5;
    const color = up ? "#C9A45C" : "#64748B";
    const opacity = (0.4 + (i / count) * 0.6).toFixed(2);
    parts.push(
      `<line x1="${x.toFixed(1)}" y1="${high.toFixed(1)}" x2="${x.toFixed(1)}" y2="${low.toFixed(1)}" stroke="${color}" stroke-width="2.2" opacity="${opacity}"/>` +
        `<rect x="${(x - step * 0.3).toFixed(1)}" y="${Math.min(open, close).toFixed(1)}" width="${(step * 0.6).toFixed(1)}" height="${Math.max(4, Math.abs(close - open)).toFixed(1)}" rx="2.5" fill="${color}" opacity="${opacity}"/>`,
    );
    trend.push(`${x.toFixed(1)},${((open + close) / 2).toFixed(1)}`);
    price = close;
  }
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="tl" x1="0" x2="1"><stop offset="0" stop-color="#E4CB93" stop-opacity="0"/><stop offset="1" stop-color="#E4CB93" stop-opacity="0.85"/></linearGradient></defs>
    ${parts.join("")}
    <polyline points="${trend.join(" ")}" fill="none" stroke="url(#tl)" stroke-width="2.5" stroke-linejoin="round"/>
  </svg>`;
}

/* Topic motifs drawn over the candles (lesson meta `motif`). Shapes and numbers only — no words, so
 * nothing on a cover can be misspelt; the lesson number seeds the candles so every cover differs. */
const GOLD = "#E4CB93";
const SLATE = "#64748B";

/** Candle series following `target(t)` (0 = top … 1 = bottom) — returns svg parts and the closes. */
function candleSeries(number, width, height, target, count = 24) {
  const rnd = seeded(number * 97 + 13);
  const step = width / count;
  let price = target(0) * height;
  const parts = [];
  const closes = [];
  for (let i = 0; i < count; i++) {
    const open = price;
    const goal = target(i / (count - 1)) * height;
    const close = Math.min(height * 0.94, Math.max(height * 0.06, open + (goal - open) * 0.75 + (rnd() - 0.5) * height * 0.08));
    const high = Math.min(open, close) - (0.01 + rnd() * 0.045) * height;
    const low = Math.max(open, close) + (0.01 + rnd() * 0.045) * height;
    const x = i * step + step * 0.5;
    const color = close < open ? "#C9A45C" : SLATE;
    const opacity = (0.4 + (i / count) * 0.6).toFixed(2);
    parts.push(
      `<line x1="${x.toFixed(1)}" y1="${high.toFixed(1)}" x2="${x.toFixed(1)}" y2="${low.toFixed(1)}" stroke="${color}" stroke-width="2.2" opacity="${opacity}"/>` +
        `<rect x="${(x - step * 0.3).toFixed(1)}" y="${Math.min(open, close).toFixed(1)}" width="${(step * 0.6).toFixed(1)}" height="${Math.max(4, Math.abs(close - open)).toFixed(1)}" rx="2.5" fill="${color}" opacity="${opacity}"/>`,
    );
    closes.push({ x, y: (open + close) / 2, high, low });
    price = close;
  }
  return { parts, closes, step };
}

const hline = (y, w, color = GOLD, dash = "8 8", op = 0.75) => `<line x1="0" y1="${y.toFixed(1)}" x2="${w}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="2" stroke-dasharray="${dash}" opacity="${op}"/>`;
const zone = (x, y, w, h, color, op) => `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="6" fill="${color}" opacity="${op}"/>`;
const label = (x, y, text, color = GOLD) => `<text x="${x}" y="${y}" fill="${color}" font-family="Space Grotesk Variable, sans-serif" font-size="17" font-weight="600" opacity="0.9">${text}</text>`;
const poly = (pts, color = GOLD, w = 3, op = 0.9, dash = "") => `<polyline points="${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" opacity="${op}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
const seg = (x1, y1, x2, y2, color = GOLD, dash = "8 8", op = 0.75, w = 2) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="${w}" stroke-dasharray="${dash}" opacity="${op}"/>`;
const dot = (x, y, color = GOLD) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="#0C111B" stroke="${color}" stroke-width="2.5" opacity="0.95"/>`;
const star = (cx, cy, r, color = GOLD) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  });
  return `<polygon points="${pts.join(" ")}" fill="${color}" opacity="0.9"/>`;
};
/** A target(t) that follows straight segments through [t, y] points (both 0…1). */
const along = (points) => (t) => {
  const i = Math.max(0, points.findIndex((p, k) => k > 0 && t <= p[0]) - 1);
  const [t0, y0] = points[i], [t1, y1] = points[Math.min(points.length - 1, i + 1)];
  return t1 === t0 ? y0 : y0 + ((y1 - y0) * (t - t0)) / (t1 - t0);
};

/** The cover chart for a lesson: candles plus the lesson's motif. Unknown/absent motif → shape by number. */
export function chartSvg(number, motif, width = 640, height = 430) {
  const W = width;
  const H = height;
  let target;
  const over = [];
  switch (motif) {
    case "levels": {
      target = (t) => 0.5 + Math.sin(t * 13) * 0.22;
      over.push(hline(H * 0.26, W), hline(H * 0.74, W, SLATE, "8 8", 0.9));
      break;
    }
    case "fibonacci": {
      target = (t) => (t < 0.55 ? 0.85 - t * 1.35 : 0.11 + (t - 0.55) * 0.75);
      over.push(zone(W - 72, 0, 72, H, "#0C111B", 0.35));
      const top = H * 0.1, bottom = H * 0.86;
      for (const [f, c] of [[0, GOLD], [0.236, SLATE], [0.382, GOLD], [0.5, SLATE], [0.618, GOLD], [1, SLATE]]) {
        const y = top + (bottom - top) * f;
        const text = f.toFixed(3).replace(/0+$/, "").replace(/\.$/, "") || "0";
        over.push(hline(y, W, c, "4 6", 0.6), zone(W - 66, y - 13, 60, 24, "#0C111B", 0.85), label(W - 60, y + 5, text, c === GOLD ? GOLD : "#94A3B8"));
      }
      break;
    }
    case "channel": {
      target = (t) => 0.78 - t * 0.55 + Math.sin(t * 16) * 0.07;
      over.push(`<line x1="0" y1="${H * 0.9}" x2="${W}" y2="${H * 0.33}" stroke="${GOLD}" stroke-width="2.5" opacity="0.85"/>`, `<line x1="0" y1="${H * 0.62}" x2="${W}" y2="${H * 0.05}" stroke="${GOLD}" stroke-width="2" stroke-dasharray="8 8" opacity="0.6"/>`);
      break;
    }
    case "double-top": {
      target = (t) => 0.75 - Math.max(0, Math.sin(t * Math.PI * 2.0)) * 0.55 + t * 0.15;
      over.push(hline(H * 0.2, W * 0.75, GOLD, "6 6", 0.7));
      break;
    }
    case "head-shoulders": {
      const pts = [0.75, 0.42, 0.62, 0.16, 0.6, 0.4, 0.82].map((y, i, a) => ({ x: (i / (a.length - 1)) * W, y: y * H }));
      target = (t) => {
        const f = t * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f));
        return (pts[i].y + (pts[i + 1].y - pts[i].y) * (f - i)) / H;
      };
      over.push(poly(pts, GOLD, 2.5, 0.55, "2 0"), hline(H * 0.61, W, SLATE, "8 6", 0.9));
      break;
    }
    case "zones": {
      target = (t) => (t < 0.4 ? 0.3 + t * 1.1 : t < 0.55 ? 0.74 - (t - 0.4) * 2.6 : 0.35 + Math.sin(t * 20) * 0.06 - (t - 0.55) * 0.4);
      over.push(zone(W * 0.36, H * 0.62, W * 0.64, H * 0.13, GOLD, 0.16), zone(W * 0.08, H * 0.18, W * 0.5, H * 0.1, SLATE, 0.28));
      break;
    }
    case "indicator": {
      target = (t) => 0.55 - t * 0.3 + Math.sin(t * 9) * 0.12;
      const ma = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        ma.push({ x: t * W, y: (0.6 - t * 0.3 + Math.sin(t * 9 - 0.6) * 0.08) * H * 0.72 });
      }
      const osc = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        osc.push({ x: t * W, y: H * 0.86 + Math.sin(t * 14) * H * 0.07 });
      }
      over.push(poly(ma, GOLD, 2.5, 0.9), hline(H * 0.79, W, SLATE, "3 6", 0.6), hline(H * 0.93, W, SLATE, "3 6", 0.6), poly(osc, "#94A3B8", 2, 0.85));
      return wrap(W, H, candleSeries(number, W, H * 0.72, (t) => 0.75 - t * 0.42 + Math.sin(t * 9) * 0.16).parts.join(""), over.join(""));
    }
    case "risk": {
      target = (t) => 0.62 - Math.sin(t * 5) * 0.08 - t * 0.12;
      const entry = H * 0.55;
      over.push(zone(W * 0.45, H * 0.18, W * 0.5, entry - H * 0.18, GOLD, 0.16), zone(W * 0.45, entry, W * 0.5, H * 0.14, SLATE, 0.32), hline(entry, W, GOLD, "0", 0.9));
      break;
    }
    case "liquidity": {
      target = (t) => (t < 0.7 ? 0.45 + Math.sin(t * 17) * 0.12 : t < 0.78 ? 0.8 : 0.8 - (t - 0.78) * 2.6);
      over.push(hline(H * 0.6, W * 0.72, GOLD, "4 6", 0.85));
      break;
    }
    case "volume": {
      target = (t) => 0.62 - t * 0.38 + Math.sin(t * 11) * 0.08;
      const rnd = seeded(number + 3);
      const bars = Array.from({ length: 24 }, (_, i) => {
        const h = (0.05 + rnd() * 0.13) * H;
        return zone(i * (W / 24) + W / 24 * 0.2, H - h, W / 24 * 0.6, h, i % 3 ? SLATE : GOLD, 0.35);
      });
      over.push(...bars);
      return wrap(W, H, candleSeries(number, W, H * 0.76, target).parts.join(""), over.join(""));
    }
    case "range-breakout": {
      // Consolidation box → false move below it → expansion (the "power of three").
      target = along([[0, 0.5], [0.12, 0.56], [0.24, 0.46], [0.36, 0.56], [0.48, 0.48], [0.6, 0.76], [0.7, 0.6], [1, 0.1]]);
      over.push(zone(W * 0.02, H * 0.38, W * 0.5, H * 0.24, SLATE, 0.22), seg(0, H * 0.62, W * 0.68, H * 0.62, GOLD, "6 6", 0.8));
      break;
    }
    case "news": {
      // Quiet market, the release time (dashed line, importance stars), then a strong move.
      target = along([[0, 0.6], [0.15, 0.56], [0.3, 0.63], [0.45, 0.57], [0.55, 0.6], [0.66, 0.2], [0.8, 0.28], [1, 0.16]]);
      const x = W * 0.57;
      over.push(seg(x, H * 0.12, x, H, GOLD, "6 6", 0.85), star(x - 30, H * 0.06, 11), star(x, H * 0.06, 11), star(x + 30, H * 0.06, 11), zone(0, H * 0.5, x, H * 0.18, SLATE, 0.16));
      break;
    }
    case "waves": {
      // Impulse waves 0…5 with the wave-2 pullback level.
      // Wave 0 starts past the chart's faded left edge so all six points are visible.
      const p = [[0.3, 0.86], [0.44, 0.54], [0.53, 0.68], [0.74, 0.18], [0.83, 0.36], [0.98, 0.08]];
      target = along([[0, 0.92], [0.15, 0.8], ...p, [1, 0.08]]);
      const pts = p.map(([t, y]) => ({ x: t * W, y: y * H }));
      over.push(poly(pts, GOLD, 2.5, 0.55), seg(pts[2].x - 40, pts[2].y, W, pts[2].y, SLATE, "6 6", 0.9));
      pts.forEach((q, i) => over.push(dot(q.x, q.y), label(q.x - 5, i % 2 ? q.y - 16 : q.y + 30, String(i))));
      break;
    }
    case "orderblock": {
      // The last opposite candle before the impulse becomes a zone; the impulse breaks the previous high.
      target = along([[0, 0.38], [0.28, 0.72], [0.34, 0.74], [0.52, 0.2], [0.72, 0.62], [1, 0.08]]);
      over.push(zone(W * 0.3, H * 0.6, W * 0.7, H * 0.17, GOLD, 0.17), seg(0, H * 0.36, W * 0.62, H * 0.36, SLATE, "6 6", 0.95));
      break;
    }
    case "structure": {
      // Higher highs: every broken high is marked with a short dashed line.
      const p = [[0, 0.84], [0.14, 0.6], [0.24, 0.7], [0.4, 0.44], [0.5, 0.54], [0.66, 0.28], [0.76, 0.38], [1, 0.1]];
      target = along(p);
      for (const k of [1, 3, 5]) over.push(seg(p[k][0] * W, p[k][1] * H, (p[k + 2][0] - 0.08) * W, p[k][1] * H, GOLD, "6 6", 0.85, 2.5));
      over.push(poly(p.map(([t, y]) => ({ x: t * W, y: y * H })), GOLD, 2, 0.35));
      break;
    }
    case "inducement": {
      // A small pullback low (the inducement) is swept on the way into the zone, then price expands.
      target = along([[0, 0.78], [0.26, 0.36], [0.34, 0.5], [0.46, 0.26], [0.64, 0.72], [1, 0.08]]);
      over.push(seg(W * 0.3, H * 0.5, W * 0.72, H * 0.5, GOLD, "4 6", 0.9), zone(W * 0.04, H * 0.66, W * 0.96, H * 0.13, SLATE, 0.28));
      break;
    }
    default: {
      const shape = number % 3;
      target = (t) => (shape === 1 ? 0.82 - t * 0.68 : shape === 2 ? (t < 0.45 ? 0.35 + t * 1.0 : 0.8 - (t - 0.45) * 1.25) : t < 0.62 ? 0.62 + Math.sin(t * 18) * 0.07 : 0.62 - (t - 0.62) * 1.35);
    }
  }
  const series = candleSeries(number, W, H, target);
  if (!motif) over.push(poly(series.closes, "url(#tl)", 2.5, 1));
  return wrap(W, H, series.parts.join(""), over.join(""));
}

function wrap(W, H, candles, over) {
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="tl" x1="0" x2="1"><stop offset="0" stop-color="#E4CB93" stop-opacity="0"/><stop offset="1" stop-color="#E4CB93" stop-opacity="0.85"/></linearGradient></defs>
    ${candles}${over}
  </svg>`;
}

const LOGO_SVG = `<svg viewBox="0 0 40 40" width="52" height="52"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#E4CB93"/><stop offset="55%" stop-color="#C9A45C"/><stop offset="100%" stop-color="#8F6F33"/></linearGradient></defs><rect x="0.75" y="0.75" width="38.5" height="38.5" rx="11" fill="#101723" stroke="url(#g)" stroke-opacity="0.55" stroke-width="1.5"/><line x1="11" y1="21" x2="11" y2="31" stroke="#C9A45C" stroke-opacity="0.55" stroke-width="1.2"/><rect x="8.5" y="23" width="5" height="6" rx="1.2" fill="url(#g)" opacity="0.7"/><line x1="20" y1="13" x2="20" y2="29" stroke="#C9A45C" stroke-opacity="0.7" stroke-width="1.2"/><rect x="17.5" y="16" width="5" height="10" rx="1.2" fill="url(#g)" opacity="0.85"/><line x1="29" y1="7" x2="29" y2="24" stroke="#C9A45C" stroke-width="1.2"/><rect x="26.5" y="9" width="5" height="12" rx="1.2" fill="url(#g)"/></svg>`;

/** The cover page (1280×720). Kept clear: the top-left corner (the catalog's "Bepul" badge), the
 *  top-right corner (the player's viewer watermark), the bottom fifth (the player's controls) and the
 *  bottom-right corner (the catalog's play button). Duration and level are shown by the site itself. */
export function coverHtml(l, fontsDir) {
  const font = (pkg) => `<link rel="stylesheet" href="${new URL(`${pkg}/index.css`, `file://${fontsDir}/`).href}">`;
  return `<!doctype html><html lang="uz"><head><meta charset="utf-8">
${font("manrope")}${font("inter")}${font("space-grotesk")}
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1280px; height: 720px; overflow: hidden; background: #080B12; font-family: "Inter Variable", sans-serif; color: #F8FAFC; }
  .cover { position: relative; width: 1280px; height: 720px; overflow: hidden;
    background: radial-gradient(70% 90% at 88% 8%, rgba(201,164,92,0.20), transparent 60%), linear-gradient(160deg, #0C111B 0%, #101723 55%, #121A27 100%); }
  .grid { position: absolute; inset: 0; opacity: .55;
    background-image: linear-gradient(to right, rgba(148,163,184,.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,.10) 1px, transparent 1px);
    background-size: 64px 64px; -webkit-mask-image: radial-gradient(ellipse 75% 70% at 70% 45%, #000 35%, transparent 80%); }
  .chart { position: absolute; right: 40px; top: 110px; opacity: .95;
    -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 30%), linear-gradient(to top, transparent 0%, #000 30%); -webkit-mask-composite: source-in; }
  .brand { position: absolute; top: 124px; left: 96px; display: flex; align-items: center; gap: 14px; }
  .brand b { display: block; font-family: "Manrope Variable"; font-weight: 800; font-size: 22px; letter-spacing: .06em; }
  .brand i { display: block; font-style: normal; font-family: "Space Grotesk Variable"; font-size: 13px; letter-spacing: .32em; color: #E4CB93; margin-top: 4px; }
  .content { position: absolute; left: 96px; top: 206px; width: 700px; }
  .chip { display: inline-block; padding: 9px 18px; border-radius: 999px; border: 1.5px solid rgba(201,164,92,.45); background: rgba(201,164,92,.08);
    font-family: "Space Grotesk Variable"; font-size: 18px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: #E4CB93; }
  .num { margin-top: 24px; font-family: "Manrope Variable"; font-weight: 800; font-size: 40px; letter-spacing: .06em;
    background: linear-gradient(100deg, #E4CB93 0%, #C9A45C 45%, #8F6F33 100%); -webkit-background-clip: text; color: transparent; }
  h1 { margin-top: 8px; font-family: "Manrope Variable"; font-weight: 800; font-size: 60px; line-height: 1.08; letter-spacing: -.01em;
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; text-wrap: balance; }
  .topics { margin-top: 26px; display: flex; flex-wrap: wrap; gap: 10px; max-width: 660px; }
  .topics span { padding: 7px 14px; border-radius: 10px; background: rgba(21,29,43,.85); border: 1px solid rgba(148,163,184,.18); font-size: 19px; color: #CBD5E1; }
  .bar { position: absolute; left: 0; bottom: 0; height: 6px; width: 100%; background: linear-gradient(90deg, #8F6F33, #C9A45C 40%, #E4CB93 70%, transparent); opacity: .85; }
</style></head><body><div class="cover">
  <div class="grid"></div>
  <div class="chart">${l.motif ? chartSvg(l.number, l.motif) : candlesSvg(l.number)}</div>
  <div class="brand">${LOGO_SVG}<span><b>AU FOREX</b><i>ACADEMY</i></span></div>
  <div class="content">
    <span class="chip">${escapeHtml(l.category)}</span>
    <div class="num">${l.numberLabel ?? `${l.number}-DARS`}</div>
    <h1>${escapeHtml(l.coverTitle ?? l.title)}</h1>
    ${l.topics?.length ? `<div class="topics">${l.topics.slice(0, 5).map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</div>` : ""}
  </div>
  <div class="bar"></div>
</div></body></html>`;
}

/** Renders covers/<NN>.jpg for every lesson of the plan and records them in plan.json. */
async function drawCovers(out, { width = 1280, padNumber = false } = {}) {
  const file = path.join(out, "plan.json");
  const p = JSON.parse(readFileSync(file, "utf8"));
  const fontsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "node_modules", "@fontsource-variable");
  const dir = path.join(out, "covers");
  mkdirSync(dir, { recursive: true });
  const { chromium } = await import("playwright");
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } : {});
  try {
    // The layout is designed at 1280×720; larger covers are the same page rendered sharper (1920 → ×1.5).
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: width / 1280 });
    for (const l of p.categories.flatMap((c) => c.courses.flatMap((k) => k.lessons))) {
      if (l.action === "skip") continue;
      if (padNumber) l.numberLabel = `${String(l.number).padStart(2, "0")}-DARS`;
      const html = path.join(dir, `${String(l.number).padStart(2, "0")}.html`);
      writeFileSync(html, coverHtml(l, fontsDir));
      await page.goto(`file://${html}`);
      await page.evaluate(() => document.fonts.ready);
      const target = path.join(dir, `${String(l.number).padStart(2, "0")}.jpg`);
      await page.screenshot({ path: target, type: "jpeg", quality: 90 });
      l.cover = path.relative(out, target);
      console.log(`✓ muqova: ${l.cover}`);
    }
  } finally {
    await browser.close();
  }
  writeFileSync(file, JSON.stringify(p, null, 2));
  writeFileSync(path.join(out, "PLAN.md"), planMarkdown(p));
}

/* ------------------------------------------------------------------ prepare */

function prepare(out, allowTranscode) {
  const file = path.join(out, "plan.json");
  const p = JSON.parse(readFileSync(file, "utf8"));
  const ready = path.join(out, "ready");
  mkdirSync(ready, { recursive: true });
  for (const l of p.categories.flatMap((c) => c.courses.flatMap((k) => k.lessons))) {
    if (l.action === "upload") {
      // An ASCII name for the browser: a file whose path has letters like ‘ is not attached by the
      // automation (the upload never starts). A hard link costs no extra disk space.
      const target = path.join(ready, `${l.sha256.slice(0, 16)}${path.extname(l.file).toLowerCase()}`);
      if (!existsSync(target)) {
        try {
          linkSync(path.join(out, l.file), target);
        } catch {
          copyFileSync(path.join(out, l.file), target);
        }
      }
      l.uploadFile = path.relative(out, target);
      continue;
    }
    if (l.action !== "remux" && !(l.action === "transcode" && allowTranscode)) continue;
    const target = path.join(ready, `${l.sha256.slice(0, 16)}.mp4`);
    if (!existsSync(target)) {
      const input = path.join(out, l.file);
      const args =
        l.action === "remux"
          ? ["-y", "-v", "error", "-i", input, "-map", "0:v:0", "-map", "0:a:0?", "-c", "copy", "-movflags", "+faststart", target]
          : ["-y", "-v", "error", "-i", input, "-map", "0:v:0", "-map", "0:a:0?", "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", target];
      console.log(`${l.action}: ${l.category} / ${l.number}. ${l.title}`);
      const r = run("ffmpeg", args);
      if (r.status !== 0) {
        console.log(`  ✗ ${r.stderr.trim().split("\n").pop()?.slice(0, 200)}`);
        continue;
      }
    }
    l.uploadFile = path.relative(out, target);
    l.uploadSize = statSync(target).size;
  }
  writeFileSync(file, JSON.stringify(p, null, 2));
  const all = p.categories.flatMap((c) => c.courses.flatMap((k) => k.lessons));
  const waiting = all.filter((l) => l.action !== "skip" && !l.uploadFile);
  console.log(`✓ Yuklashga tayyor: ${all.filter((l) => l.uploadFile).length} ta${waiting.length ? ` · ${waiting.length} tasi qayta kodlash ruxsatini kutmoqda (--allow-transcode)` : ""}`);
}

/* ------------------------------------------------------------------ import (Super admin panel) */

/** Browser signed in as a super admin (IMPORT_ADMIN_EMAIL / IMPORT_ADMIN_PASSWORD). */
async function adminSession(site) {
  const email = process.env.IMPORT_ADMIN_EMAIL;
  const password = process.env.IMPORT_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("IMPORT_ADMIN_EMAIL va IMPORT_ADMIN_PASSWORD kerak (super admin hisobi)");
  const { chromium } = await import("playwright");
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } : {});
  const context = await browser.newContext({ baseURL: site, ...(process.env.IMPORT_STORAGE_STATE ? { storageState: process.env.IMPORT_STORAGE_STATE } : {}) });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  try {
    await open(page, "/login");
    await page.getByLabel("Email yoki login").fill(email);
    await page.getByLabel("Parol", { exact: true }).fill(password);
    await page.getByTestId("login-form").getByRole("button", { name: "Kirish" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
    await open(page, "/super-admin/categories");
    if (!(await page.getByTestId("new-category-course").isVisible().catch(() => false))) throw new Error("Bu hisob super admin emas");
  } catch (err) {
    await browser.close();
    throw err;
  }
  console.log(`✓ ${new URL(site).host} — super admin sifatida kirildi`);
  return { browser, page };
}

const planLessons = (p) => p.categories.flatMap((c) => c.courses.flatMap((k) => k.lessons.map((l) => ({ ...l, courseTitle: k.title }))));

/** Every planned lesson: on the site exactly once, and its video served from storage (Range → 206). */
async function verifySite(out, site) {
  const p = JSON.parse(readFileSync(path.join(out, "plan.json"), "utf8"));
  const { browser, page } = await adminSession(site);
  let bad = 0;
  try {
    for (const l of planLessons(p).filter((x) => x.action !== "skip")) {
      const label = `${l.category} / ${l.number}. ${l.title}`;
      await open(page, `/super-admin/lessons?q=${encodeURIComponent(l.title)}`);
      const rows = page
        .getByTestId("admin-lesson-row")
        .filter({ has: page.getByText(l.title, { exact: true }) })
        .filter({ hasText: l.courseTitle });
      const count = await rows.count();
      if (count !== 1) {
        bad++;
        console.log(`✗ ${label}: saytda ${count} ta`);
        continue;
      }
      const href = await rows.first().getByRole("link", { name: "Tahrirlash" }).getAttribute("href");
      const id = href?.split("/").pop();
      // Same path a student's player takes: the app answers with a short-lived storage link.
      const media = await page.evaluate(async (lessonId) => {
        try {
          const r = await fetch(`/api/lessons/${lessonId}/video`, { headers: { Range: "bytes=0-1023" } });
          return { status: r.status, type: r.headers.get("content-type") };
        } catch (e) {
          return { status: 0, type: String(e) };
        }
      }, id);
      const ok = media.status === 206 && /^video\//.test(media.type ?? "");
      if (!ok) bad++;
      console.log(`${ok ? "✓" : "✗"} ${label}: video ${media.status} ${media.type ?? ""}`);
    }
  } finally {
    await browser.close();
  }
  console.log(bad ? `\n✗ ${bad} ta muammo` : "\n✓ Barcha darslar saytda bitta nusxada, videolar ombordan ochiladi");
  if (bad) process.exitCode = 1;
}

/** Publishes the plan's courses (lessons are already published; a course hides them until then). */
async function publishCourses(out, site) {
  const p = JSON.parse(readFileSync(path.join(out, "plan.json"), "utf8"));
  const { browser, page } = await adminSession(site);
  try {
    const seen = new Set();
    for (const course of p.categories.flatMap((c) => c.courses)) {
      if (seen.has(course.title)) continue;
      seen.add(course.title);
      await open(page, "/super-admin/courses");
      const toggle = page.getByRole("switch", { name: `${course.title} nashr holati`, exact: true });
      if ((await toggle.count()) !== 1) {
        console.log(`✗ ${course.title}: kurs topilmadi yoki bir nechta`);
        process.exitCode = 1;
        continue;
      }
      if ((await toggle.getAttribute("aria-checked")) === "true") {
        console.log(`= ${course.title}: allaqachon nashr qilingan`);
        continue;
      }
      await toggle.click();
      await page.waitForFunction((el) => el?.getAttribute("aria-checked") === "true", await toggle.elementHandle(), { timeout: 30_000 });
      console.log(`✓ ${course.title}: nashr qilindi`);
    }
  } finally {
    await browser.close();
  }
}

/** Replaces the cover of lessons that are already on the site with the plan's current cover. */
async function updateCovers(out, site) {
  const p = JSON.parse(readFileSync(path.join(out, "plan.json"), "utf8"));
  const { browser, page } = await adminSession(site);
  let done = 0;
  try {
    for (const l of planLessons(p).filter((x) => x.action !== "skip" && x.cover)) {
      const label = `${l.number}. ${l.title}`;
      await open(page, `/super-admin/lessons?q=${encodeURIComponent(l.title)}`);
      const rows = page.getByTestId("admin-lesson-row").filter({ has: page.getByText(l.title, { exact: true }) }).filter({ hasText: l.courseTitle });
      if ((await rows.count()) !== 1) {
        console.log(`✗ ${label}: saytda ${await rows.count()} ta — o‘tkazib yuborildi`);
        process.exitCode = 1;
        continue;
      }
      await rows.first().getByRole("link", { name: "Tahrirlash" }).click();
      await page.waitForURL(/\/super-admin\/lessons\/[^/]+$/);
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
      const uploaded = page.waitForResponse((r) => r.url().endsWith("/api/admin/uploads") && (r.request().postData() ?? "").includes('"action":"complete"'), { timeout: 60_000 }).catch(() => null);
      await page.locator('input[type="file"][accept="image/png,image/jpeg,image/webp"]').setInputFiles(path.join(out, l.cover));
      const res = await uploaded;
      if (!res || !res.ok()) {
        console.log(`✗ ${label}: muqova yuklanmadi`);
        process.exitCode = 1;
        continue;
      }
      await page.getByTestId("lesson-save").click();
      await page.waitForURL((u) => u.pathname === "/super-admin/lessons", { timeout: 60_000 });
      done++;
      console.log(`✓ ${label}: muqova yangilandi`);
    }
  } finally {
    await browser.close();
  }
  console.log(`Yakun: ${done} ta muqova yangilandi`);
}

async function importToSite(out, site, publishNow) {
  const p = JSON.parse(readFileSync(path.join(out, "plan.json"), "utf8"));
  const ledgerFile = path.join(out, "ledger.json");
  const ledger = existsSync(ledgerFile) ? JSON.parse(readFileSync(ledgerFile, "utf8")) : {};
  const save = () => writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2));

  const { browser, page } = await adminSession(site);
  if (process.env.IMPORT_DEBUG) {
    // Hosts, paths and statuses only (no query strings: presigned links carry signatures).
    page.on("response", (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith("/api/") || u.host.includes("r2.cloudflarestorage")) console.log(`  · ${r.request().method()} ${u.host.split(".")[0].slice(0, 12)} ${u.pathname.slice(0, 50)} → ${r.status()}`);
    });
    page.on("requestfailed", (r) => console.log(`  · FAILED ${r.method()} ${new URL(r.url()).host.split(".")[0].slice(0, 12)} ${r.failure()?.errorText}`));
    page.on("console", (m) => m.type() === "error" && console.log(`  · console: ${m.text().replace(/\?[^ ]*/g, "?…").slice(0, 200)}`));
  }
  try {
    await open(page, "/super-admin/categories");

    // Categories (new ones are added at the end, in plan order). Only the lesson/course list counts —
    // the same page also lists book categories. The innermost block holding the "new course category"
    // field and its rows is that list.
    const courseCategories = page
      .locator("div, section, ul")
      .filter({ has: page.getByTestId("new-category-course") })
      .filter({ has: page.getByTestId("category-row") })
      .last();
    for (const cat of p.categories) {
      const row = courseCategories.getByTestId("category-row").filter({ has: page.getByText(cat.name, { exact: true }) });
      if (await row.first().isVisible().catch(() => false)) continue;
      await page.getByTestId("new-category-course").fill(cat.name);
      await page.getByTestId("new-category-course").press("Enter");
      await row.first().waitFor();
      console.log(`＋ Kategoriya: ${cat.name}`);
    }

    // Courses.
    for (const cat of p.categories) {
      for (const course of cat.courses) {
        await open(page, "/super-admin/courses");
        // First cell: the title, then "#order · /slug".
        const titles = await page.locator("tbody tr td:first-child > span:first-child").allInnerTexts();
        if (titles.some((t) => t.trim().toLowerCase() === course.title.toLowerCase())) continue;
        await page.getByTestId("new-course").click();
        const dialog = page.getByRole("dialog");
        await page.getByTestId("course-title").fill(course.title);
        if (course.description) await dialog.getByLabel("Tavsif").fill(course.description);
        await dialog.getByLabel("Kategoriya").selectOption({ label: course.category ?? cat.name });
        if (publishNow || course.publish) await dialog.getByRole("switch").click();
        await dialog.getByRole("button", { name: "Saqlash" }).click();
        await page.locator("tbody tr td:first-child > span:first-child", { hasText: course.title }).first().waitFor();
        console.log(`＋ Kurs: ${course.title}${publishNow || course.publish ? " (nashr qilingan)" : " (nashr qilinmagan)"}`);
      }
    }

    // Lessons.
    const lessons = planLessons(p);
    let created = 0;
    let skipped = 0;
    const failed = [];
    for (const l of lessons) {
      const label = `${l.category} / ${l.number}. ${l.title}`;
      if (l.action === "skip" || !l.uploadFile) {
        if (l.action !== "skip") console.log(`… ${label}: tayyor emas (prepare)`);
        continue;
      }
      if (ledger[l.sha256]?.status === "created") {
        skipped++;
        continue;
      }
      // Already on the site (an earlier run, or added by hand)? Search by title within the course.
      await open(page, `/super-admin/lessons?q=${encodeURIComponent(l.title)}`);
      const existing = page
        .getByTestId("admin-lesson-row")
        .filter({ has: page.getByText(l.title, { exact: true }) })
        .filter({ hasText: l.courseTitle });
      if (await existing.first().isVisible().catch(() => false)) {
        ledger[l.sha256] = { status: "created", note: "saytda bor edi", title: l.title };
        save();
        skipped++;
        console.log(`= ${label}: saytda bor — o‘tkazib yuborildi`);
        continue;
      }
      try {
        await open(page, "/super-admin/lessons/new");
        await page.getByTestId("lesson-title").fill(l.title);
        await page.getByTestId("lesson-course").selectOption({ label: l.courseTitle });
        await page.getByTestId("lesson-category").selectOption({ label: l.category });
        await page.getByTestId("lesson-number").fill(String(l.number));
        if (l.level) await page.getByTestId("lesson-level").selectOption(l.level);
        await page.getByTestId("lesson-access").selectOption(l.access === "FREE" ? "FREE" : "PRO");
        const text = [l.summary, l.description].filter(Boolean).join("\n\n");
        if (text) await page.getByLabel("Dars tavsifi").fill(text);
        if (l.cover) {
          // The cover field has no test id; it is the form's only image input.
          await page.locator('input[type="file"][accept="image/png,image/jpeg,image/webp"]').setInputFiles(path.join(out, l.cover));
          await page.getByText("Rasm yuklangan").waitFor({ timeout: 60_000 });
        }
        const size = l.uploadSize ?? l.size;
        const started = Date.now();
        const uploading = page.getByTestId("video-upload-progress").or(page.getByText("Video yuklangan"));
        for (let attempt = 1; ; attempt++) {
          await page.getByTestId("video-upload").setInputFiles(path.join(out, l.uploadFile));
          if (await uploading.first().waitFor({ timeout: 15_000 }).then(() => true, () => false)) break;
          if (attempt >= 3) throw new Error("yuklash boshlanmadi");
        }
        await page.getByText("Video yuklangan").waitFor({ timeout: 120_000 + Math.ceil(size / (256 * 1024)) * 1000 });
        const speed = size / Math.max(1, (Date.now() - started) / 1000);
        if ((await page.getByTestId("lesson-publish").getAttribute("aria-checked")) !== "true") await page.getByTestId("lesson-publish").click();
        await page.getByTestId("lesson-save").click();
        const outcome = await Promise.race([
          page.waitForURL((u) => u.pathname === "/super-admin/lessons", { timeout: 60_000 }).then(() => "ok"),
          page.getByText(/allaqachon bor/).waitFor({ timeout: 60_000 }).then(() => "exists"),
        ]);
        if (outcome === "exists") {
          ledger[l.sha256] = { status: "created", note: "raqam band — saytda bor", title: l.title };
          skipped++;
          console.log(`= ${label}: ${l.number}-dars kursda allaqachon bor — o‘tkazib yuborildi`);
        } else {
          ledger[l.sha256] = { status: "created", title: l.title, at: new Date().toISOString() };
          created++;
          console.log(`✓ ${label} · ${mb(size)} · ${mb(speed)}/s`);
        }
        save();
      } catch (err) {
        failed.push(label);
        const toast = await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => []);
        console.log(`✗ ${label}: ${(toast.join(" | ") || String(err?.message ?? err)).split("\n")[0].slice(0, 200)}`);
      }
    }
    console.log(`\nYakun: ${created} ta yangi dars · ${skipped} ta avval bor edi · ${failed.length} ta xato${failed.length ? " — buyruqni qayta ishga tushiring, qolganlari davom etadi" : ""}`);
    if (failed.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

/* ------------------------------------------------------------------ cli */

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: "string", default: "content-import" },
      free: { type: "string", default: "0" },
      meta: { type: "string" },
      width: { type: "string" },
      "pad-number": { type: "boolean", default: false },
      site: { type: "string" },
      "allow-transcode": { type: "boolean", default: false },
      "publish-courses": { type: "boolean", default: false },
    },
  });
  const [command, source] = positionals;
  const out = path.resolve(values.out);
  mkdirSync(out, { recursive: true });
  try {
    if (command === "plan") {
      if (!source) throw new Error("Arxiv yoki papka yo‘lini bering");
      await plan(source, out, Number(values.free) || 0, values.meta ? path.resolve(values.meta) : null);
    } else if (command === "covers") await drawCovers(out, { width: Number(values.width) || 1280, padNumber: values["pad-number"] });
    else if (command === "prepare") prepare(out, values["allow-transcode"]);
    else if (["import", "verify", "publish", "update-covers"].includes(command)) {
      if (!values.site) throw new Error("--site https://… kerak");
      const site = values.site.replace(/\/$/, "");
      if (command === "import") await importToSite(out, site, values["publish-courses"]);
      else if (command === "verify") await verifySite(out, site);
      else if (command === "update-covers") await updateCovers(out, site);
      else await publishCourses(out, site);
    } else {
      console.log("Buyruqlar: plan <zip|papka> [--meta] · covers · prepare · import · verify · publish --site <url> (batafsil: fayl boshidagi izoh)");
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}
