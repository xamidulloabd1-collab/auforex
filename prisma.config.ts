import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

/**
 * Same .env files, in the same order, as Next.js (`npm run dev`: .env.development.local →
 * .env.local → .env.development → .env; variables set in the shell or on Vercel win). So
 * `prisma migrate …` and the running site always use the same database. (Previously only `.env`
 * was read here, while the site could be using a different DATABASE_URL from `.env.local`.)
 */
const { loadedEnvFiles } = loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", {
  info() {},
  error: console.error,
});

// Migrations need a direct (non-pooled) connection: DIRECT_URL if set, else DATABASE_URL
// (with Prisma Postgres on Vercel, DATABASE_URL is the direct address).
const url = process.env.DIRECT_URL || process.env.DATABASE_URL || "";

function target(raw: string) {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^\[|\]$/g, "");
    return { host, label: `${host}:${u.port || "5432"}/${decodeURIComponent(u.pathname.slice(1)) || "postgres"}` };
  } catch {
    return null;
  }
}

const args = process.argv.slice(2);
const touchesDatabase = ["migrate", "db", "studio"].includes(args[0] ?? "");
const t = url ? target(url) : null;
if (touchesDatabase && t) {
  // Host, port and database name only — never the login or password.
  const files = loadedEnvFiles.map((f) => f.path).join(", ") || "tizim o‘zgaruvchilari";
  console.error(`[prisma] Baza: ${t.label}  (o‘qilgan: ${files})`);
}

// Commands that can wipe data are refused on any database that is not on this computer,
// unless explicitly allowed. Protects the production database from a local `migrate reset`.
const destructive =
  (args[0] === "migrate" && (args[1] === "reset" || args[1] === "dev")) ||
  (args[0] === "db" && args[1] === "push" && args.some((a) => a === "--force-reset" || a === "--accept-data-loss"));
const isLocal = t ? ["localhost", "127.0.0.1", "::1", "db"].includes(t.host) : true;
if (destructive && !isLocal && process.env.ALLOW_REMOTE_DB_RESET !== "yes") {
  throw new Error(
    `“prisma ${args.slice(0, 2).join(" ")}” ma’lumotlarni o‘chirishi mumkin, baza esa bu kompyuterda emas (${t?.label}). ` +
      "Production bazada faqat “npx prisma migrate deploy” ishlating. Ataylab bo‘lsa: ALLOW_REMOTE_DB_RESET=yes",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: { url },
});
