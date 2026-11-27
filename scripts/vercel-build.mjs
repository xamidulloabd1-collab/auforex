// Vercel build command (vercel.json → "npm run build:vercel").
//
// Why: `next build` alone never creates the database tables. A deployment then shows
// "Ready", but every page that reads the database fails at runtime (React error #441,
// "The table public.Challenge does not exist"). This script:
//   1. checks the required settings and stops the build with a clear message if one is missing;
//   2. production only: shows the migration status, then applies pending migrations with
//      `prisma migrate deploy` (never resets or drops data; retried while the database wakes up);
//   3. only when SEED_ON_BUILD=true: runs the idempotent seed (never by default — production data
//      is changed only by migrations and by the Super admin);
//   4. runs `npm run build`.
// If a step fails the build fails, so Vercel keeps serving the previous working deployment.
//
// Overrides: MIGRATE_ON_BUILD=true|false (default: production only), SEED_ON_BUILD=true (default off).
//
// Preview safety (a Preview must never change the production database):
//   - every non-production build prints the database fingerprint and a READ-ONLY `prisma migrate status`;
//   - DATABASE_URL and DATABASE_URL_POOLED must point at the same database, or the build stops;
//   - migrations/seed on a Preview run only when PREVIEW_DB_FINGERPRINT equals the fingerprint of
//     DATABASE_URL — set after checking that this database is the isolated test one (docs/PREVIEW.md).
import { spawnSync } from "node:child_process";
import path from "node:path";
import { databaseFingerprint, previewDatabaseMismatch } from "./lib/db-identity.mjs";

const root = process.cwd();
const env = { ...process.env };
const target = env.VERCEL_ENV || (env.VERCEL === "1" ? "preview" : "local");
const log = (s) => console.log(`[vercel-build] ${s}`);
const die = (s) => {
  console.error(`\n[vercel-build] ✗ ${s}\n`);
  process.exit(1);
};
const flag = (name, fallback) => (env[name] === "true" ? true : env[name] === "false" ? false : fallback);

// 1. Settings ---------------------------------------------------------------------------------
if (!env.DATABASE_URL) {
  die("DATABASE_URL yo‘q. Vercel → Storage → Prisma Postgres bazasini shu loyihaga ulang (Production muhitiga ham), so‘ng qayta deploy qiling.");
}
if (env.DATABASE_URL.startsWith("prisma+postgres://")) {
  die("DATABASE_URL Accelerate manzili (prisma+postgres://). Prisma Console’dan to‘g‘ridan-to‘g‘ri postgres:// manzilini oling va DATABASE_URL ga qo‘ying.");
}
const secret = env.BETTER_AUTH_SECRET ?? "";
if (secret.length < 32 || secret.startsWith("replace-with")) {
  die("BETTER_AUTH_SECRET yo‘q yoki 32 belgidan qisqa. Yarating: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\" va Vercel → Settings → Environment Variables ga qo‘shing.");
}
if (!env.NEXT_PUBLIC_APP_URL) {
  const host =
    target === "production" ? env.VERCEL_PROJECT_PRODUCTION_URL : env.VERCEL_BRANCH_URL || env.VERCEL_URL || env.VERCEL_PROJECT_PRODUCTION_URL;
  if (host) env.NEXT_PUBLIC_APP_URL = `https://${host}`;
}
log(`Muhit: ${target} · sayt: ${env.NEXT_PUBLIC_APP_URL || "(noma’lum)"}`);

const prismaCli = env.PRISMA_CLI_PATH || path.join(root, "node_modules", "prisma", "build", "index.js");
const run = (args, opts = {}) =>
  spawnSync(process.execPath, args, { cwd: root, env, stdio: opts.capture ? "pipe" : "inherit", encoding: "utf8" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const migrate = flag("MIGRATE_ON_BUILD", target === "production");
const seed = flag("SEED_ON_BUILD", false);

// Preview database checks (read-only) ------------------------------------------------------------
if (target !== "production") {
  const mismatch = previewDatabaseMismatch(env);
  if (mismatch) die(mismatch);
  const fingerprint = databaseFingerprint(env.DATABASE_URL);
  const pooledFingerprint = env.DATABASE_URL_POOLED?.trim() ? databaseFingerprint(env.DATABASE_URL_POOLED) : null;
  const hostOf = (u) => {
    try {
      return new URL(u).host;
    } catch {
      return "?";
    }
  };
  log(`Baza barmoq izi (fingerprint): ${fingerprint ?? "aniqlanmadi"} — manzil va parol chiqarilmaydi`);
  log(
    `  direct: ${hostOf(env.DATABASE_URL)} → ${fingerprint ?? "?"}` +
      (pooledFingerprint ? ` · pooled: ${hostOf(env.DATABASE_URL_POOLED)} → ${pooledFingerprint}` : " · pooled: o‘rnatilmagan"),
  );
  log("Baza holati (faqat o‘qish, prisma migrate status):");
  const status = run([prismaCli, "migrate", "status"], { capture: true });
  const statusText = `${status.stdout ?? ""}${status.stderr ?? ""}`.trim();
  if (statusText) console.log(statusText.split("\n").map((l) => `    ${l}`).join("\n"));
  if (target === "preview" && (migrate || seed)) {
    if (!env.PREVIEW_DB_FINGERPRINT || env.PREVIEW_DB_FINGERPRINT !== fingerprint) {
      die(
        "Preview’da migratsiya/seed so‘ralgan, lekin baza tasdiqlanmagan: PREVIEW_DB_FINGERPRINT " +
          (env.PREVIEW_DB_FINGERPRINT ? "boshqa bazaga tegishli" : "o‘rnatilmagan") +
          ". Avval shu bazaning alohida test bazasi ekanini tekshiring (docs/PREVIEW.md).",
      );
    }
    log("Preview test bazasi tasdiqlangan (fingerprint mos) — migratsiya/seed shu bazada.");
  }
}

// 2. Migrations --------------------------------------------------------------------------------
if (migrate) {
  log("Migratsiya holati (prisma migrate status):");
  const status = run([prismaCli, "migrate", "status"], { capture: true });
  const statusText = `${status.stdout ?? ""}${status.stderr ?? ""}`.trim();
  if (statusText) console.log(statusText.split("\n").map((l) => `    ${l}`).join("\n"));
  let migrated = false;
  for (let attempt = 1; attempt <= 4 && !migrated; attempt++) {
    log(`Migratsiyalarni qo‘llash (prisma migrate deploy), urinish ${attempt}/4…`);
    migrated = run([prismaCli, "migrate", "deploy"]).status === 0;
    if (!migrated && attempt < 4) await sleep(5000);
  }
  if (!migrated) die("Migratsiyalar qo‘llanmadi. Yuqoridagi Prisma xabarini va DATABASE_URL ni tekshiring.");
} else {
  log(`Migratsiyalar o‘tkazib yuborildi (${target}). Production deploy ularni qo‘llaydi; majburlash: MIGRATE_ON_BUILD=true`);
}

// 3. Seed --------------------------------------------------------------------------------------
if (seed) {
  log("Boshlang‘ich ma’lumotlar (seed)…");
  const tsx = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
  if (run([tsx, "prisma/seed.ts"]).status !== 0) die("Seed xato bilan tugadi — yuqoridagi xabarni tekshiring.");
}

// 4. Next.js build ------------------------------------------------------------------------------
const npmCli = process.env.npm_execpath;
const build = npmCli
  ? spawnSync(process.execPath, [npmCli, "run", "build"], { cwd: root, env, stdio: "inherit" })
  : spawnSync("npm", ["run", "build"], { cwd: root, env, stdio: "inherit", shell: process.platform === "win32" });
process.exit(build.status ?? 1);
