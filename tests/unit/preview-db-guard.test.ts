import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseFingerprint, databaseIdentity, previewDatabaseMismatch, sameDatabase } from "../../scripts/lib/db-identity.mjs";

const PROD = "postgres://prod_user:prod_secret@db.prisma.io:5432/postgres?sslmode=require";
const PROD_POOLED = "postgres://prod_user:prod_secret@pooled.db.prisma.io:5432/postgres?sslmode=require";
const TEST = "postgres://test_user:test_secret@db.prisma.io:5432/postgres?sslmode=require";

describe("database identity (never the password)", () => {
  it("treats the direct and pooled address of one database as the same database", () => {
    expect(sameDatabase(PROD, PROD_POOLED)).toBe(true);
    expect(sameDatabase(
      "postgresql://u:p@ep-cool-1-pooler.eu-central-1.aws.neon.tech/neondb",
      "postgresql://u:p@ep-cool-1.eu-central-1.aws.neon.tech/neondb",
    )).toBe(true);
  });

  it("tells different databases apart", () => {
    expect(sameDatabase(PROD, TEST)).toBe(false);
    expect(sameDatabase(PROD, "not a url")).toBe(false);
    expect(sameDatabase(undefined, PROD)).toBe(false);
  });

  it("fingerprints are short, stable and reveal neither password nor host", () => {
    const fp = databaseFingerprint(PROD)!;
    expect(fp).toMatch(/^[0-9a-f]{12}$/);
    expect(databaseFingerprint(PROD_POOLED)).toBe(fp);
    expect(databaseFingerprint(TEST)).not.toBe(fp);
    expect(databaseIdentity(PROD)).not.toContain("prod_secret");
  });

  it("a Preview with one variable on the test database and the other on production is refused", () => {
    expect(previewDatabaseMismatch({ DATABASE_URL: TEST, DATABASE_URL_POOLED: PROD_POOLED })).toMatch(/turli bazalarga/);
    expect(previewDatabaseMismatch({ DATABASE_URL: TEST, DATABASE_URL_POOLED: TEST })).toBeNull();
    expect(previewDatabaseMismatch({ DATABASE_URL: TEST })).toBeNull();
  });
});

describe("runtime: a mismatched Preview never connects", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("throws before opening any connection", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("DATABASE_URL", TEST);
    vi.stubEnv("DATABASE_URL_POOLED", PROD_POOLED);
    const { getPrisma } = await import("@/lib/db/prisma");
    expect(() => getPrisma()).toThrow(/turli bazalarga/);
  });
});

/**
 * Runs scripts/vercel-build.mjs with a stand-in Prisma CLI and npm (nothing connects to a database):
 * the stand-ins only record which commands were called.
 */
function runBuild(env: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), "vercel-build-"));
  const calls = path.join(dir, "calls.txt");
  writeFileSync(calls, "");
  const prisma = path.join(dir, "prisma.js");
  writeFileSync(prisma, `require("fs").appendFileSync(${JSON.stringify(calls)}, "prisma " + process.argv.slice(2).join(" ") + "\\n"); console.log("stub status");`);
  const npm = path.join(dir, "npm.js");
  writeFileSync(npm, `require("fs").appendFileSync(${JSON.stringify(calls)}, "npm " + process.argv.slice(2).join(" ") + "\\n");`);
  const res = spawnSync(process.execPath, ["scripts/vercel-build.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      NODE_ENV: "production",
      VERCEL: "1",
      BETTER_AUTH_SECRET: "x".repeat(48),
      NEXT_PUBLIC_APP_URL: "https://preview.example.vercel.app",
      PRISMA_CLI_PATH: prisma,
      npm_execpath: npm,
      ...env,
    },
  });
  return { status: res.status, out: `${res.stdout}${res.stderr}`, calls: readFileSync(calls, "utf8") };
}

describe("Vercel build: Preview database gate", () => {
  it("a Preview build only reads the database status (no migrate deploy, no seed)", () => {
    const r = runBuild({ VERCEL_ENV: "preview", DATABASE_URL: PROD, DATABASE_URL_POOLED: PROD_POOLED });
    expect(r.status).toBe(0);
    expect(r.calls).toContain("prisma migrate status");
    expect(r.calls).not.toContain("migrate deploy");
    expect(r.calls).toContain("npm run build");
    expect(r.out).toContain(databaseFingerprint(PROD)!);
    expect(r.out).not.toContain("prod_secret");
  });

  it("stops when DATABASE_URL and DATABASE_URL_POOLED point at different databases", () => {
    const r = runBuild({ VERCEL_ENV: "preview", DATABASE_URL: TEST, DATABASE_URL_POOLED: PROD_POOLED });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/turli bazalarga/);
    expect(r.calls).toBe("");
  });

  it("refuses migrations/seed on a Preview without a matching PREVIEW_DB_FINGERPRINT", () => {
    const noFp = runBuild({ VERCEL_ENV: "preview", DATABASE_URL: PROD, MIGRATE_ON_BUILD: "true", SEED_ON_BUILD: "true" });
    expect(noFp.status).toBe(1);
    expect(noFp.out).toMatch(/baza tasdiqlanmagan/);
    expect(noFp.calls).not.toContain("migrate deploy");

    // A fingerprint approved for the test database does not unlock the production one.
    const wrong = runBuild({ VERCEL_ENV: "preview", DATABASE_URL: PROD, MIGRATE_ON_BUILD: "true", PREVIEW_DB_FINGERPRINT: databaseFingerprint(TEST)! });
    expect(wrong.status).toBe(1);
    expect(wrong.calls).not.toContain("migrate deploy");
  });

  it("runs migrations on the approved Preview test database", () => {
    const r = runBuild({ VERCEL_ENV: "preview", DATABASE_URL: TEST, MIGRATE_ON_BUILD: "true", PREVIEW_DB_FINGERPRINT: databaseFingerprint(TEST)! });
    expect(r.status).toBe(0);
    expect(r.calls).toContain("prisma migrate deploy");
  });

  it("production builds are unchanged: migrate status + deploy, no Preview gate", () => {
    const r = runBuild({ VERCEL_ENV: "production", DATABASE_URL: PROD });
    expect(r.status).toBe(0);
    expect(r.calls).toContain("prisma migrate deploy");
    expect(r.out).not.toMatch(/barmoq izi/);
  });
});
