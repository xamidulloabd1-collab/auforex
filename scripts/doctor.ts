/**
 * Full local health check:  npm run doctor
 * Explains what is wrong (in Uzbek) and the exact command that fixes it.
 */
import { existsSync, readdirSync } from "node:fs";
import { access, constants, mkdir } from "node:fs/promises";
import path from "node:path";
import { checkEnv } from "../lib/env-schema";
import { isWeakSecret, localDbPort } from "./lib/env-file.mjs";
import { describeDbUrl, describeEnv, explainMissing, loadProjectEnv } from "./lib/env-load.mjs";
import { missingPackages } from "./lib/packages.mjs";

// Read the .env files exactly as `npm run dev` does, and remember where each setting came from.
const ENV_KEYS = [
  "DATABASE_URL",
  "DATABASE_URL_POOLED",
  "DIRECT_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
];
const envReport = describeEnv({ keys: ENV_KEYS, mode: "development", initialEnv: { ...process.env } });
loadProjectEnv(process.cwd(), "development");

type Result = { ok: boolean | "warn"; title: string; fix?: string };
const results: Result[] = [];
const ok = (title: string) => results.push({ ok: true, title });
const warn = (title: string, fix?: string) => results.push({ ok: "warn", title, fix });
const fail = (title: string, fix?: string) => results.push({ ok: false, title, fix });

const root = process.cwd();

function describeDbError(err: unknown): { title: string; fix: string } {
  const text = `${String(err)} ${JSON.stringify(err, Object.getOwnPropertyNames(err ?? {}))} ${String((err as { cause?: unknown })?.cause ?? "")}`;
  if (/timeout exceeded|connection timeout|Connection terminated|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH/i.test(text)) {
    return {
      title: "Baza javob bermadi (ulanish vaqti tugadi) — bu kompyuterdan baza serveriga yo‘l yo‘q",
      fix: "Masofadagi baza bo‘lsa: internet/provayder yoki firewall 5432-portni yopmaganini tekshiring (PowerShell: Test-NetConnection <host> -Port 5432). Lokal ishlash uchun: npm run db:fix (Docker).",
    };
  }
  if (/ECONNREFUSED|P1001|Can't reach database/i.test(text)) {
    return {
      title: "PostgreSQL’ga ulanib bo‘lmadi (server ishlamayapti yoki port noto‘g‘ri)",
      fix: "Avtomatik tuzatish:  npm run db:fix   (Docker Desktop ochiq bo‘lsin)",
    };
  }
  if (/28P01|password authentication failed|P1000|Authentication failed/i.test(text)) {
    return {
      title: "PostgreSQL login/parolni qabul qilmadi — bu port’da boshqa PostgreSQL ishlayotgan yoki Docker bazasining paroli boshqacha",
      fix: "Avtomatik tuzatish:  npm run db:fix   (Docker bazasini topadi, kerak bo‘lsa bo‘sh portga ko‘chiradi; ma’lumot o‘chmaydi)",
    };
  }
  if (/3D000|P1003|does not exist/i.test(text) && /database/i.test(text)) {
    return { title: "DATABASE_URL’dagi baza mavjud emas", fix: "npm run db:fix  (bazani yaratadi), so‘ng npx prisma migrate deploy" };
  }
  if (/ENOTFOUND|getaddrinfo/i.test(text)) {
    return { title: "DATABASE_URL’dagi server manzili topilmadi", fix: "Lokal ishlatsangiz host “localhost” bo‘lishi kerak." };
  }
  return { title: `Bazaga ulanishda xato: ${String(err).split("\n")[0]}`, fix: "DATABASE_URL’ni tekshiring." };
}

async function main() {
  // 1. Runtime
  const [major, minor] = process.versions.node.split(".").map(Number) as [number, number];
  if (major > 20 || (major === 20 && minor >= 9)) ok(`Node.js ${process.versions.node}`);
  else fail(`Node.js ${process.versions.node} — kamida 20.9 kerak`, "https://nodejs.org dan 22 LTS o‘rnating.");

  // 2. Files
  if (existsSync(path.join(root, "app", "admin"))) {
    fail("Eski versiyadan qolgan app/admin papkasi bor", "O‘chiring: Remove-Item -Recurse -Force app\\admin  (yoki yangi ZIP’ni bo‘sh papkaga oching).");
  } else ok("Loyiha fayllari (eski versiya qoldiqlari yo‘q)");
  existsSync(path.join(root, "lib", "db", "generated")) ? ok("Prisma client yaratilgan") : fail("Prisma client yo‘q", "npx prisma generate");
  existsSync(path.join(root, "public", "pdfjs", "pdf.worker.min.mjs"))
    ? ok("PDF o‘quvchi (pdf.js worker) joyida")
    : fail("public/pdfjs/pdf.worker.min.mjs yo‘q — kitoblar ochilmaydi", "node scripts/copy-pdf-worker.mjs");

  const missingPkgs = missingPackages(root);
  if (missingPkgs.length) fail(`O‘rnatilmagan paketlar: ${missingPkgs.join(", ")}`, "npm install  (package.json yangilangan)");
  else ok("Barcha paketlar o‘rnatilgan");

  // 3. Environment — which file each setting comes from (values are never printed)
  if (!envReport.files.length) fail(".env fayli yo‘q", "npm run setup");
  else ok(`npm run dev o‘qiydigan .env fayllari (ustuvorlik bo‘yicha): ${envReport.files.join(" → ")}`);
  const sources = ENV_KEYS.filter((k) => envReport.keys[k]!.state === "set").map((k) => `${k} ← ${envReport.keys[k]!.source}`);
  if (sources.length) ok(`Qiymat manbalari: ${sources.join(", ")}`);
  for (const key of ENV_KEYS) {
    const info = envReport.keys[key]!;
    if (info.state === "empty" && info.shadows && key !== "DATABASE_URL" && key !== "BETTER_AUTH_SECRET") warn(explainMissing(key, info, "development"));
  }
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) fail(explainMissing("DATABASE_URL", envReport.keys.DATABASE_URL!, "development"), "npm run setup, so‘ng npm run db:fix");
  if (!process.env.BETTER_AUTH_SECRET?.trim()) {
    fail(explainMissing("BETTER_AUTH_SECRET", envReport.keys.BETTER_AUTH_SECRET!, "development"), "npm run setup  (yangi maxfiy kalit yaratadi)");
  } else if (isWeakSecret(process.env.BETTER_AUTH_SECRET)) {
    fail(`BETTER_AUTH_SECRET namunaviy yoki qisqa (manba: ${envReport.keys.BETTER_AUTH_SECRET!.source})`, "npm run setup  (yangi maxfiy kalit yaratadi)");
  } else ok(`BETTER_AUTH_SECRET o‘rnatilgan (manba: ${envReport.keys.BETTER_AUTH_SECRET!.source})`);
  const urlPort = localDbPort(dbUrl);
  const composePort = process.env.DB_PORT || "5432";
  if (urlPort && urlPort !== composePort) {
    warn(
      `DATABASE_URL porti ${urlPort}, docker compose esa bazani ${composePort} portda ochadi`,
      `.env’da ikkalasini bir xil qiling: DB_PORT="${urlPort}"  (so‘ng: docker compose up -d db)`,
    );
  }
  const envCheck = checkEnv(process.env);
  if (envCheck.ok) ok(".env qiymatlari to‘g‘ri formatda");
  else for (const issue of envCheck.issues) fail(`.env: ${issue}`, "Qiymatni .env.example’dagi namunaga moslang yoki bo‘sh qoldiring (npm run setup yetishmaganlarini to‘ldiradi).");
  const site = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (site && process.env.NEXT_PUBLIC_APP_URL && process.env.BETTER_AUTH_URL && process.env.BETTER_AUTH_URL !== process.env.NEXT_PUBLIC_APP_URL) {
    warn("BETTER_AUTH_URL va NEXT_PUBLIC_APP_URL har xil", "Ikkalasi bir xil manzil bo‘lishi kerak (masalan http://localhost:3000).");
  } else if (site) ok(`Sayt manzili: ${site}`);

  // 4. Storage
  const storageRoot = path.resolve(root, process.env.STORAGE_LOCAL_ROOT || "./storage");
  try {
    await mkdir(storageRoot, { recursive: true });
    await access(storageRoot, constants.W_OK);
    ok(`Fayllar papkasi yoziladi: ${storageRoot}`);
  } catch {
    fail(`Fayllar papkasiga yozib bo‘lmaydi: ${storageRoot}`, "STORAGE_LOCAL_ROOT’ni tekshiring yoki papkaga ruxsat bering.");
  }

  // 5. Database
  // The site connects through DATABASE_URL_POOLED when it is set, otherwise DATABASE_URL.
  const runtimeKey = process.env.DATABASE_URL_POOLED?.trim() ? "DATABASE_URL_POOLED" : "DATABASE_URL";
  const runtimeUrl = process.env[runtimeKey]?.trim();
  if (runtimeUrl) {
    const db = describeDbUrl(runtimeUrl);
    const { createScriptPrisma } = await import("../prisma/seed-helpers");
    const prisma = createScriptPrisma(runtimeUrl);
    try {
      await prisma.$queryRawUnsafe("SELECT 1");
      ok(`PostgreSQL’ga ulanish: ${db.target} (${runtimeKey}, manba: ${envReport.keys[runtimeKey]!.source})`);
      if (db.kind !== "local") warn(`Lokal sayt masofadagi bazaga ulangan (${db.host}) — production bo‘lsa, lokal amallar haqiqiy saytga yoziladi`, "Lokal ishlash uchun alohida baza: npm run db:fix");

      const dir = path.join(root, "prisma", "migrations");
      const expected = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
      let applied: string[] = [];
      try {
        const rows = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
          `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
        );
        applied = rows.map((r) => r.migration_name);
      } catch {
        applied = [];
      }
      const pending = expected.filter((m) => !applied.includes(m));
      if (pending.length) fail(`Qo‘llanmagan migratsiyalar: ${pending.join(", ")}`, "npx prisma migrate deploy");
      else ok(`Migratsiyalar qo‘llangan (${expected.length} ta)`);

      if (!pending.length) {
        const username = (process.env.FOUNDER_USERNAME || "asadbek").toLowerCase();
        const [founder, admins, books, settings] = await Promise.all([
          prisma.user.findFirst({ where: { username }, select: { role: true, status: true } }),
          prisma.user.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE" } }),
          prisma.book.findMany({ select: { title: true, fileKey: true } }),
          prisma.siteSetting.count(),
        ]);
        if (!settings) fail("Boshlang‘ich ma’lumotlar yo‘q", "npm run db:seed");
        if (!founder) fail(`Founder hisobi (“${username}”) topilmadi`, "npm run db:seed   yoki   npm run founder:password");
        else if (founder.role !== "SUPER_ADMIN" || founder.status !== "ACTIVE") fail("Founder hisobi super admin emas yoki bloklangan", "npm run founder:password");
        else ok(`Founder hisobi “${username}” — super admin. Parolni unutgan bo‘lsangiz: npm run founder:password`);
        if (admins === 0) fail("Faol super admin yo‘q", "npm run founder:password");
        if (books.length === 0) warn("Kutubxonada kitob yo‘q", "npm run db:seed  (3 ta kitob qo‘shiladi)");
        else if (process.env.S3_BUCKET?.trim() || process.env.STORAGE_DRIVER === "s3") {
          ok(`Kitoblar: ${books.length} ta (fayllar S3 omborida — tekshirish: Super admin → Kitoblar → Tekshirish)`);
        } else {
          const missing = [];
          for (const b of books) {
            // bundled/… files ship with the app (prisma/seed-assets), everything else lives in storage/.
            const file = b.fileKey.startsWith("bundled/")
              ? path.join(root, "prisma", "seed-assets", b.fileKey.slice("bundled/".length))
              : path.join(storageRoot, b.fileKey);
            if (!existsSync(file)) missing.push(b.title);
          }
          if (missing.length) {
            fail(`Bazada bor, lekin fayli yo‘q kitoblar: ${missing.join("; ")}`, "Super admin → Kitoblar’da faylni qayta yuklang yoki storage papkasini qaytaring.");
          } else ok(`Kitoblar: ${books.length} ta, fayllari joyida`);
        }
      }
    } catch (err) {
      const d = describeDbError(err);
      fail(d.title, d.fix);
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  }

  // Report
  console.log("\nAU Forex Academy — tekshiruv\n");
  for (const r of results) {
    const icon = r.ok === true ? "✓" : r.ok === "warn" ? "⚠" : "✗";
    console.log(`${icon} ${r.title}`);
    if (r.fix && r.ok !== true) console.log(`    → ${r.fix}`);
  }
  const failed = results.filter((r) => r.ok === false).length;
  console.log(failed ? `\n${failed} ta muammo topildi. Yuqoridagi buyruqlarni bajarib, qayta tekshiring: npm run doctor\n` : `\nHammasi joyida. Ishga tushirish:  npm run dev  →  ${(site ?? "http://localhost:3000").replace(/\/$/, "")}  (panel: /super-admin)\n`);
  process.exitCode = failed ? 1 : 0;
}

void main();
