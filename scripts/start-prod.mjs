// Production entrypoint (Docker image, Railway, any VPS):  node scripts/start-prod.mjs
//   1. checks the required settings and explains what is missing (Uzbek + English);
//   2. applies database migrations (retries while the database is still starting);
//   3. runs the idempotent seed (categories, settings, founder account, the 3 books);
//   4. starts Next.js on $PORT and forwards shutdown signals.
// Options: MIGRATE_ON_START=false, SEED_ON_START=false to skip steps 2 / 3.
import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants, mkdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const env = { ...process.env, NODE_ENV: "production" };
const log = (s) => console.log(`[start] ${s}`);
const warn = (s) => console.warn(`[start] ⚠ ${s}`);
const die = (s) => {
  console.error(`\n[start] ✗ ${s}\n`);
  process.exit(1);
};
const bin = (p) => path.join(root, "node_modules", p);

// --- 1. Settings -------------------------------------------------------------------------
const railwayUrl = env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : "";
env.BETTER_AUTH_URL ||= env.NEXT_PUBLIC_APP_URL || railwayUrl;
env.NEXT_PUBLIC_APP_URL ||= env.BETTER_AUTH_URL;

if (!env.DATABASE_URL) {
  die("DATABASE_URL yo‘q. Railway: Variables → DATABASE_URL = ${{Postgres.DATABASE_URL}}  (DATABASE_URL is not set)");
}
if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32 || env.BETTER_AUTH_SECRET.startsWith("replace-with")) {
  die("BETTER_AUTH_SECRET yo‘q yoki juda qisqa (kamida 32 belgi). Yaratish: npm run deploy:env  (BETTER_AUTH_SECRET missing/weak)");
}
if (!env.BETTER_AUTH_URL) {
  die("Sayt manzili noma’lum. Railway’da Settings → Networking → Generate Domain bosing yoki BETTER_AUTH_URL=https://… kiriting.");
}
if (!env.FOUNDER_PASSWORD) {
  warn("FOUNDER_PASSWORD berilmagan — founder hisobi birinchi marta yaratilsa, parol shu loglarda bir marta ko‘rsatiladi.");
}

// Persistent uploads: an explicit STORAGE_LOCAL_ROOT wins, then the Railway volume, then /app/storage.
env.STORAGE_LOCAL_ROOT ||= env.RAILWAY_VOLUME_MOUNT_PATH || path.join(root, "storage");
if (env.RAILWAY_ENVIRONMENT && !env.RAILWAY_VOLUME_MOUNT_PATH) {
  warn("Railway Volume ulanmagan: yuklangan kitob/video/rasmlar har yangi deployda o‘chib ketadi. Volume qo‘shing (mount path: /app/storage).");
} else if (env.RAILWAY_VOLUME_MOUNT_PATH && path.resolve(env.STORAGE_LOCAL_ROOT) !== path.resolve(env.RAILWAY_VOLUME_MOUNT_PATH)) {
  warn(`STORAGE_LOCAL_ROOT (${env.STORAGE_LOCAL_ROOT}) Volume manzili (${env.RAILWAY_VOLUME_MOUNT_PATH}) bilan bir xil emas — fayllar Volume’ga yozilmaydi.`);
}
try {
  mkdirSync(env.STORAGE_LOCAL_ROOT, { recursive: true });
  accessSync(env.STORAGE_LOCAL_ROOT, constants.W_OK);
} catch {
  die(`Fayllar papkasiga yozib bo‘lmaydi: ${env.STORAGE_LOCAL_ROOT}`);
}
log(`Sayt: ${env.BETTER_AUTH_URL} · fayllar: ${env.STORAGE_LOCAL_ROOT}`);

// --- 2. Migrations ---------------------------------------------------------------------------
const run = (args, label) => {
  log(label);
  const r = spawnSync(process.execPath, args, { cwd: root, env, stdio: "inherit" });
  return r.status ?? 1;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (env.MIGRATE_ON_START !== "false") {
  let ok = false;
  for (let attempt = 1; attempt <= 6 && !ok; attempt++) {
    ok = run([bin("prisma/build/index.js"), "migrate", "deploy"], `Migratsiyalar (urinish ${attempt}/6)…`) === 0;
    if (!ok && attempt < 6) await sleep(5000);
  }
  if (!ok) die("Migratsiyalarni qo‘llab bo‘lmadi — yuqoridagi xatoni va DATABASE_URL’ni tekshiring.");
}

// --- 3. Seed (safe to repeat: existing data is kept) --------------------------------------------
if (env.SEED_ON_START !== "false") {
  if (run([bin("tsx/dist/cli.mjs"), "prisma/seed.ts"], "Boshlang‘ich ma’lumotlar (seed)…") !== 0) {
    warn("Seed xato bilan tugadi — sayt baribir ishga tushadi. Loglarni tekshiring.");
  }
}

// --- 4. Next.js ------------------------------------------------------------------------------------
const port = env.PORT || "3000";
log(`Next.js ${port}-portda ishga tushmoqda…`);
const child = spawn(process.execPath, [bin("next/dist/bin/next"), "start", "-p", port], { cwd: root, env, stdio: "inherit" });
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 0 : 1)));
