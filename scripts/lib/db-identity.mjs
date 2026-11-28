// Which database a connection string points at — without revealing it.
// Used by lib/db/prisma.ts (runtime) and scripts/vercel-build.mjs (build) to keep a Vercel Preview
// from ever reaching the production database by accident.
import { createHash } from "node:crypto";

/**
 * "user@host/database" with the pooler part of the host removed, so the direct and the pooled
 * address of one database compare equal (Prisma Postgres: pooled.db.prisma.io, Neon: -pooler).
 * No password. null when the string is not a PostgreSQL URL.
 */
export function databaseIdentity(raw) {
  if (!raw) return null;
  try {
    const url = new URL(String(raw).trim());
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") return null;
    const host = url.hostname
      .toLowerCase()
      .replace(/^pooled\./, "")
      .replace(/^([^.]+)-pooler\./, "$1.");
    const database = url.pathname.replace(/^\/+/, "") || "postgres";
    return `${decodeURIComponent(url.username)}@${host}/${database}`;
  } catch {
    return null;
  }
}

/** True only when both strings are PostgreSQL URLs of the same database. */
export function sameDatabase(a, b) {
  const x = databaseIdentity(a);
  return x !== null && x === databaseIdentity(b);
}

/** Short, non-reversible label of a database (12 hex characters) — safe to print in build logs. */
export function databaseFingerprint(raw) {
  const id = databaseIdentity(raw);
  return id ? createHash("sha256").update(id).digest("hex").slice(0, 12) : null;
}

/**
 * Preview deployments must use ONE database for both the app (DATABASE_URL_POOLED) and the
 * migrations/seed (DATABASE_URL). Returns a message when they point at different databases.
 */
export function previewDatabaseMismatch(source) {
  const direct = source.DATABASE_URL?.trim();
  const pooled = source.DATABASE_URL_POOLED?.trim();
  if (!direct || !pooled || sameDatabase(direct, pooled)) return null;
  return (
    "Preview: DATABASE_URL va DATABASE_URL_POOLED turli bazalarga qaraydi (biri production bo‘lishi mumkin). " +
    "Vercel → Settings → Environment Variables: shu branch uchun ikkalasini ham bir xil test bazasiga o‘rnating (docs/PREVIEW.md)."
  );
}
