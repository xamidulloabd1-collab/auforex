#!/usr/bin/env node
/**
 * Video lessons from a ZIP (or folder) onto the site — through the Super admin panel, so the site's
 * own storage keys and checks are used (no database or bucket keys on this computer).
 *
 *   node scripts/content-import.mjs plan    <archive.zip | folder> [--out content-import] [--free 1]
 *   node scripts/content-import.mjs prepare [--out content-import] [--allow-transcode]
 *   node scripts/content-import.mjs import  --site https://… [--out content-import] [--publish-courses]
 *   node scripts/content-import.mjs verify  --site https://… [--out content-import]
 *   node scripts/content-import.mjs publish --site https://… [--out content-import]
 *
 * plan     unpacks the archive, reads every video (ffprobe), finds duplicates by content and writes
 *          plan.json + PLAN.md for approval: categories, courses, lesson numbers and titles, access,
 *          and what each file needs (upload as is / lossless remux / re-encode / skip).
 * prepare  makes browser-ready copies: MP4 with the index at the start (lossless). Re-encoding to
 *          H.264/AAC only with --allow-transcode (it changes the video, so it is never automatic).
 * import   signs in as a super admin (IMPORT_ADMIN_EMAIL / IMPORT_ADMIN_PASSWORD) and creates the
 *          missing categories, courses and lessons with their videos. Safe to run again: lessons that
 *          already exist (same title or number in the course) are skipped; progress is kept in ledger.json.
 * verify   checks every planned lesson on the site: it exists once, and its video answers from storage.
 * publish  publishes the plan's courses (only after the content has been checked and approved).
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

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const mmss = (s) => (s == null ? "—" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

/** Opens an admin page and waits until it is interactive: input made before React hydrates is lost. */
async function open(page, url) {
  await page.goto(url);
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
}

/* ------------------------------------------------------------------ plan */

async function plan(source, out, freeCount) {
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
  for (const c of p.categories) {
    lines.push(`## ${c.order}. ${c.name}`, "");
    for (const k of c.courses) {
      if (k.title !== c.name) lines.push(`### Kurs: ${k.title}`, "");
      lines.push("| № | Dars nomi | Davomiyligi | Hajmi | Kirish | Holat | Fayl |", "|---|---|---|---|---|---|---|");
      for (const l of k.lessons) {
        lines.push(`| ${l.number} | ${l.title} | ${mmss(l.durationSeconds)} | ${mb(l.size)} | ${l.access === "FREE" ? "Bepul" : "PRO"} | **${l.action}** ${l.reason} | \`${path.basename(l.file)}\` |`);
      }
      lines.push("");
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
    for (const course of p.categories.flatMap((c) => c.courses)) {
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
        await dialog.getByLabel("Kategoriya").selectOption({ label: cat.name });
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
      await plan(source, out, Number(values.free) || 0);
    } else if (command === "prepare") prepare(out, values["allow-transcode"]);
    else if (["import", "verify", "publish"].includes(command)) {
      if (!values.site) throw new Error("--site https://… kerak");
      const site = values.site.replace(/\/$/, "");
      if (command === "import") await importToSite(out, site, values["publish-courses"]);
      else if (command === "verify") await verifySite(out, site);
      else await publishCourses(out, site);
    } else {
      console.log("Buyruqlar: plan <zip|papka> · prepare · import · verify · publish --site <url> (batafsil: fayl boshidagi izoh)");
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}
