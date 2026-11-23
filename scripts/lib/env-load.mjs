// One way to read the .env files for every tool — the same way Next.js does — plus a report of
// where each setting comes from. Values are never returned or printed: only file names and states.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import * as nextEnvModule from "@next/env";
import { parse } from "dotenv";

// @next/env is CommonJS: native ESM sees it as `default`, tsx/CJS as named exports.
const { loadEnvConfig } = nextEnvModule.default ?? nextEnvModule;

/** Files Next.js reads, highest priority first. The first file that defines a key wins — even with an empty value. */
export function envFilesFor(mode) {
  if (mode === "test") return [".env.test.local", ".env.test", ".env"];
  return [`.env.${mode}.local`, ".env.local", `.env.${mode}`, ".env"];
}

const ALL_FILES = [
  ".env.development.local",
  ".env.production.local",
  ".env.test.local",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.test",
  ".env",
];

/** "development" for `next dev` and local tools, "production" for `next build` / `next start`. */
export function currentMode(env = process.env) {
  if (env.NODE_ENV === "test") return "test";
  return env.NODE_ENV === "production" ? "production" : "development";
}

/**
 * Loads the .env files into process.env exactly like Next.js (variables already set in the
 * shell / on Vercel win). Returns the names of the files that were read.
 */
export function loadProjectEnv(root = process.cwd(), mode = currentMode()) {
  const quiet = { info() {}, error: (...a) => console.error(...a) };
  const { loadedEnvFiles } = loadEnvConfig(root, mode === "development", quiet, true);
  return loadedEnvFiles.map((f) => f.path);
}

function readParsed(root, file) {
  const full = path.join(root, file);
  if (!existsSync(full)) return null;
  try {
    return parse(readFileSync(full, "utf8"));
  } catch {
    return null;
  }
}

const isBlank = (v) => v === undefined || String(v).trim() === "";

/**
 * Where each key comes from in `mode`, without values.
 * @returns {{
 *   files: string[],
 *   keys: Record<string, { state: "set" | "empty" | "missing", source: string | null,
 *                          shadows: string | null, ignoredIn: string[] }>
 * }}
 *  - source: "environment" (shell / Vercel), a file name, or null
 *  - shadows: a lower-priority file that has a value, hidden by an empty value in `source`
 *  - ignoredIn: files that have a value but are not read in this mode (e.g. .env.production.local for `npm run dev`)
 */
export function describeEnv({ root = process.cwd(), mode = currentMode(), keys, initialEnv = process.env }) {
  const order = envFilesFor(mode);
  const parsed = Object.fromEntries(ALL_FILES.map((f) => [f, readParsed(root, f)]));
  const files = order.filter((f) => parsed[f]);
  const out = {};
  for (const key of keys) {
    let state = "missing";
    let source = null;
    let shadows = null;
    if (initialEnv[key] !== undefined) {
      source = "environment";
      state = isBlank(initialEnv[key]) ? "empty" : "set";
    } else {
      const i = order.findIndex((f) => parsed[f] && key in parsed[f]);
      if (i >= 0) {
        source = order[i];
        state = isBlank(parsed[source][key]) ? "empty" : "set";
      }
    }
    const later = source === "environment" ? order : order.slice(order.indexOf(source) + 1);
    if (state === "empty") shadows = later.find((f) => parsed[f] && !isBlank(parsed[f][key])) ?? null;
    const ignoredIn = ALL_FILES.filter((f) => !order.includes(f) && parsed[f] && !isBlank(parsed[f][key]));
    out[key] = { state, source, shadows, ignoredIn };
  }
  return { files, keys: out };
}

/** Uzbek explanation for a key that is missing or empty, naming files only. */
export function explainMissing(key, info, mode) {
  const cmd = mode === "development" ? "npm run dev" : "next build / next start";
  if (info.state === "empty" && info.shadows) {
    const where = info.source === "environment" ? "terminal/tizim o‘zgaruvchisi sifatida" : `${info.source} faylida`;
    return `${key} ${where} bo‘sh va ${info.shadows} dagi qiymatni bekor qilmoqda (Next.js birinchi topilgan qiymatni oladi, bo‘sh bo‘lsa ham). ${info.source === "environment" ? "Uni o‘chiring" : `${info.source} dan ${key} qatorini o‘chiring yoki to‘g‘ri qiymat yozing`}.`;
  }
  if (info.ignoredIn.length) {
    return `${key} faqat ${info.ignoredIn.join(", ")} da bor — “${cmd}” bu faylni o‘qimaydi. Qiymatni ${envFilesFor(mode).filter((f) => f !== `.env.${mode}`).slice(-1)[0]} ga yozing.`;
  }
  if (info.state === "empty") return `${key} ${info.source === "environment" ? "tizim o‘zgaruvchisi" : info.source} da bo‘sh.`;
  return `${key} hech bir .env faylida yo‘q.`;
}

/** host:port/database and kind of a PostgreSQL URL — never the user or password. */
export function describeDbUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^\[|\]$/g, "");
    const port = u.port || "5432";
    const database = decodeURIComponent(u.pathname.replace(/^\//, "")) || "postgres";
    const kind = ["localhost", "127.0.0.1", "::1"].includes(host)
      ? "local"
      : host === "db.prisma.io"
        ? "prisma-direct"
        : host === "pooled.db.prisma.io"
          ? "prisma-pooled"
          : u.protocol.startsWith("prisma")
            ? "accelerate"
            : "remote";
    return { target: `${host}:${port}/${database}`, host, port: Number(port), kind };
  } catch {
    return { target: "(noto‘g‘ri URL)", host: "", port: 0, kind: "invalid" };
  }
}

/**
 * Settings in files that `npm run dev` reads before `.env` (so they win over what setup/db:fix
 * write into `.env`). Returns one warning line per key, naming files only.
 */
export function dotEnvOverrideWarnings(root, keys, mode = "development") {
  const lines = [];
  for (const file of envFilesFor(mode).filter((f) => f !== ".env")) {
    const parsed = readParsed(root, file);
    if (!parsed) continue;
    for (const key of keys) {
      if (!(key in parsed)) continue;
      lines.push(
        `${file} dagi ${key}${isBlank(parsed[key]) ? " (bo‘sh)" : ""} .env dagisidan ustun turadi — sayt o‘shani ishlatadi. Kerak bo‘lmasa, ${file} dan shu qatorni o‘chiring.`,
      );
    }
  }
  return lines;
}
