// Fast checks before `npm run dev` / `npm run build` (no database access).
// Catches the most common local mistakes with a clear message instead of a cryptic stack trace.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getEnvValue, isWeakSecret } from "./lib/env-file.mjs";
import { explainDbFailure, parseDbUrl, probeDb } from "./lib/db-probe.mjs";

const mode = process.argv[2] === "build" ? "build" : "dev";
const root = process.cwd();
const errors = [];
const warnings = [];

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 9)) {
  errors.push(`Node.js ${process.versions.node} juda eski. Kamida 20.9 kerak (22 LTS tavsiya etiladi): https://nodejs.org`);
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
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) {
    errors.push(".env fayli yo‘q. Bajaring:  npm run setup");
  } else {
    const text = readFileSync(envPath, "utf8");
    if (!getEnvValue(text, "DATABASE_URL")) errors.push(".env: DATABASE_URL bo‘sh.");
    if (isWeakSecret(getEnvValue(text, "BETTER_AUTH_SECRET"))) {
      warnings.push(".env: BETTER_AUTH_SECRET namunaviy yoki qisqa. Yangisini yaratish:  npm run setup");
    }
  }
}

// Every page reads the database: if it is unreachable, say why before the dev server starts.
if (mode === "dev" && !errors.length && process.env.SKIP_DB_CHECK !== "1") {
  const envText = existsSync(path.join(root, ".env")) ? readFileSync(path.join(root, ".env"), "utf8") : "";
  const url = process.env.DATABASE_URL || getEnvValue(envText, "DATABASE_URL");
  if (url) {
    const res = await probeDb(url, { timeoutMs: 3000 });
    if (!res.ok && res.kind !== "nodb") {
      let cfg = {};
      try {
        cfg = parseDbUrl(url);
      } catch {}
      errors.push(
        [
          `Ma’lumotlar bazasiga ulanib bo‘lmadi: ${explainDbFailure(res.kind, cfg)}`,
          "  Avtomatik tuzatish:  npm run db:fix",
          "  (tekshiruvsiz ishga tushirish: SKIP_DB_CHECK=1 npm run dev)",
        ].join("\n"),
      );
    } else if (res.kind === "nodb") {
      warnings.push("Baza hali yaratilmagan: npm run db:fix, so‘ng npx prisma migrate deploy va npm run db:seed");
    }
  }
}

for (const w of warnings) console.warn(`⚠  ${w}`);
if (errors.length) {
  console.error("\n✗ Ishga tushirishdan oldin tuzating:\n");
  for (const e of errors) console.error(`• ${e}\n`);
  console.error("To‘liq tekshiruv:  npm run doctor\n");
  process.exit(1);
}
