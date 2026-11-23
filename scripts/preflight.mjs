// Fast checks before `npm run dev` / `npm run build`.
// Reads the .env files exactly the way Next.js will, so what it reports is what the site will use.
// Never prints secret values — only file names, states and database host:port.
import { existsSync } from "node:fs";
import path from "node:path";
import { missingPackages } from "./lib/packages.mjs";

const mode = process.argv[2] === "build" ? "build" : "dev";
const root = process.cwd();
const errors = [];
const warnings = [];
const notes = [];

function finish() {
  for (const n of notes) console.log(`ℹ  ${n}`);
  for (const w of warnings) console.warn(`⚠  ${w}`);
  if (errors.length) {
    console.error("\n✗ Ishga tushirishdan oldin tuzating:\n");
    for (const e of errors) console.error(`• ${e}\n`);
    console.error("To‘liq tekshiruv:  npm run doctor\n");
    process.exit(1);
  }
}

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 9)) {
  errors.push(`Node.js ${process.versions.node} juda eski. Kamida 20.9 kerak (22 LTS tavsiya etiladi): https://nodejs.org`);
}

// package.json changed (e.g. after git pull or a new ZIP) but `npm install` was not run.
const missing = missingPackages(root, { dev: mode === "dev" });
if (missing.length) {
  errors.push(
    [
      `O‘rnatilmagan paketlar: ${missing.join(", ")}`,
      "  package.json yangilangan, node_modules esa eski. Bajaring:  npm install",
      "  (VS Code’dagi “Cannot find module …” xatosi ham shundan; o‘rnatgach: Ctrl+Shift+P → “TypeScript: Restart TS Server”)",
    ].join("\n"),
  );
  finish();
}

// Left-overs from older ZIPs extracted over the new version. They no longer compile.
const stale = ["app/admin"].filter((p) => existsSync(path.join(root, p)));
if (stale.length) {
  errors.push(
    [
      `Eski versiyadan qolgan papka topildi: ${stale.join(", ")}`,
      "  Admin panel endi /super-admin manzilida. Eski papkani o‘chiring:",
      ...stale.map((p) => `    Windows PowerShell:  Remove-Item -Recurse -Force ${p.replace("/", "\\")}`),
      ...stale.map((p) => `    macOS / Linux:       rm -rf ${p}`),
      "  Eng to‘g‘risi — yangi ZIP’ni bo‘sh papkaga ochish (eski papka ustiga emas).",
    ].join("\n"),
  );
}

if (!existsSync(path.join(root, "lib", "db", "generated"))) {
  errors.push("Prisma client yaratilmagan. Bajaring:  npx prisma generate");
}

if (mode === "dev") {
  const { describeDbUrl, describeEnv, explainMissing, loadProjectEnv } = await import("./lib/env-load.mjs");
  const { isWeakSecret } = await import("./lib/env-file.mjs");
  const envMode = "development";
  const initialEnv = { ...process.env };
  const report = describeEnv({
    root,
    mode: envMode,
    keys: ["DATABASE_URL", "DATABASE_URL_POOLED", "DIRECT_URL", "BETTER_AUTH_SECRET"],
    initialEnv,
  });
  loadProjectEnv(root, envMode); // process.env now holds what `next dev` will see

  if (!report.files.length && !initialEnv.DATABASE_URL) {
    errors.push(".env fayli yo‘q. Bajaring:  npm run setup");
  } else {
    notes.push(`npm run dev o‘qiydigan .env fayllari (ustuvorlik bo‘yicha): ${report.files.join(" → ") || "yo‘q (faqat tizim o‘zgaruvchilari)"}`);
  }

  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || !secret.trim()) {
    errors.push(`${explainMissing("BETTER_AUTH_SECRET", report.keys.BETTER_AUTH_SECRET, envMode)}\n  Busiz kirish va ro‘yxatdan o‘tish 503 qaytaradi. Yangi kalit:  npm run setup`);
  } else if (secret.length < 32) {
    errors.push(`BETTER_AUTH_SECRET 32 belgidan qisqa (manba: ${report.keys.BETTER_AUTH_SECRET.source}). Yangi kalit:  npm run setup`);
  } else if (isWeakSecret(secret)) {
    warnings.push(`BETTER_AUTH_SECRET namunaviy qiymat (manba: ${report.keys.BETTER_AUTH_SECRET.source}). Yangisini yaratish:  npm run setup`);
  }

  // The site connects through DATABASE_URL_POOLED when it is set, otherwise DATABASE_URL.
  const runtimeKey = process.env.DATABASE_URL_POOLED?.trim() ? "DATABASE_URL_POOLED" : "DATABASE_URL";
  const runtimeUrl = process.env[runtimeKey]?.trim();
  if (!runtimeUrl) {
    errors.push(explainMissing("DATABASE_URL", report.keys.DATABASE_URL, envMode));
  } else {
    const db = describeDbUrl(runtimeUrl);
    notes.push(`Sayt ulanadigan baza: ${db.target} (${runtimeKey}, manba: ${report.keys[runtimeKey].source})`);
    const cliKey = process.env.DIRECT_URL?.trim() ? "DIRECT_URL" : "DATABASE_URL";
    const cliUrl = process.env[cliKey]?.trim();
    if (cliUrl && describeDbUrl(cliUrl).target !== db.target) {
      notes.push(`Prisma CLI (migratsiya, seed) bazasi: ${describeDbUrl(cliUrl).target} (${cliKey}, manba: ${report.keys[cliKey].source})`);
    }
    if (db.kind !== "local") {
      warnings.push(
        `Lokal sayt masofadagi bazaga ulanadi (${db.host}). Agar bu production bazasi bo‘lsa, lokalda qilingan har bir o‘zgarish (ro‘yxatdan o‘tish, admin amallari, seed) haqiqiy saytga yoziladi. Lokal ishlash uchun alohida baza: npm run db:fix`,
      );
    }
    if (db.kind === "accelerate") {
      errors.push(`${runtimeKey} Prisma Accelerate manzili (prisma+postgres://). Bu loyiha to‘g‘ridan-to‘g‘ri postgres:// manzilini talab qiladi.`);
    } else if (process.env.SKIP_DB_CHECK !== "1") {
      const { explainDbFailure, parseDbUrl, probeDb } = await import("./lib/db-probe.mjs");
      const res = await probeDb(runtimeUrl, { timeoutMs: 6000 });
      if (!res.ok && res.kind !== "nodb") {
        let cfg = {};
        try {
          cfg = parseDbUrl(runtimeUrl);
        } catch {}
        errors.push(
          [
            `Ma’lumotlar bazasiga ulanib bo‘lmadi (${runtimeKey}, manba: ${report.keys[runtimeKey].source}): ${explainDbFailure(res.kind, cfg)}`,
            db.kind === "local"
              ? "  Avtomatik tuzatish:  npm run db:fix"
              : [".env", "environment"].includes(report.keys[runtimeKey].source)
                ? "  Lokal baza bilan ishlash:  npm run db:fix  (Docker; ishlaydigan manzilni .env’ga yozadi)"
                : `  Lokal baza bilan ishlash: ${report.keys[runtimeKey].source} dan ${runtimeKey} qatorini o‘chiring, so‘ng  npm run db:fix  (Docker)`,
            "  (tekshiruvsiz ishga tushirish: SKIP_DB_CHECK=1 npm run dev)",
          ].join("\n"),
        );
      } else if (res.kind === "nodb") {
        warnings.push("Baza hali yaratilmagan: npm run db:fix, so‘ng npx prisma migrate deploy va npm run db:seed");
      }
    }
  }
}

finish();
