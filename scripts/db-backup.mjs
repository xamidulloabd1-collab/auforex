#!/usr/bin/env node
/**
 * Backup of the site's PostgreSQL database — and proof that it can be restored.
 * Run it on YOUR computer; the data never leaves it. Nothing is written to the source database.
 *
 *   BACKUP_DATABASE_URL="postgres://…@db.prisma.io:5432/postgres?sslmode=require" npm run db:backup
 *
 * BACKUP_DATABASE_URL: the DIRECT connection string (host db.prisma.io, not pooled) — Vercel →
 * Storage → your database → ".env.local" tab, or Prisma Console → Connection strings. It can also be
 * put in a file named .env.backup next to package.json (never share or commit it).
 *
 * Steps:
 *  1. shows the database fingerprint (compare with "Baza barmoq izi" in the Vercel build log —
 *     production is 85bcf18c856b) and the server version;
 *  2. counts the rows of every table (read-only transaction);
 *  3. pg_dump in custom format → backups/auforex-<fingerprint>-<time>.dump (a consistent snapshot);
 *  4. restore test: restores the file into a throwaway PostgreSQL (Docker container, removed
 *     afterwards — or RESTORE_TEST_URL, a local server where a scratch database may be created)
 *     and compares the row counts table by table;
 *  5. writes the result next to the file (.json) with the file's SHA-256.
 *
 * Tools: Docker Desktop (uses the postgres:17 image; Prisma Postgres runs PostgreSQL 17), or
 * PostgreSQL 17+ command-line tools (pg_dump, pg_restore, psql) plus RESTORE_TEST_URL.
 * The dump holds personal data and password hashes: keep it encrypted and offline.
 */
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { databaseFingerprint } from "./lib/db-identity.mjs";

const IMAGE = process.env.BACKUP_PG_IMAGE || "postgres:17";
/** Tables written on every request: a different count after the snapshot is expected there. */
const VOLATILE = new Set(["session", "rate_limit", "ratelimit", "verification", "verificationtoken", "verification_token"]);

/** PG* variables for a URL, so the password is never on a command line. */
export function pgEnv(raw) {
  const url = new URL(raw);
  if (!/^postgres(ql)?:$/.test(url.protocol)) throw new Error("PostgreSQL manzili emas (postgres://…)");
  return {
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.replace(/^\/+/, "") || "postgres",
    PGSSLMODE: url.searchParams.get("sslmode") || (["localhost", "127.0.0.1"].includes(url.hostname) ? "disable" : "require"),
  };
}

/** Compares table counts; volatile tables may differ, everything else must match. */
export function compareCounts(live, restored) {
  const rows = [];
  for (const table of [...new Set([...Object.keys(live), ...Object.keys(restored)])].sort()) {
    const a = live[table];
    const b = restored[table];
    const same = a === b;
    const volatile = VOLATILE.has(table.toLowerCase().replace(/"/g, ""));
    rows.push({ table, live: a ?? null, restored: b ?? null, status: same ? "ok" : b === undefined ? "missing" : volatile ? "volatile" : "different" });
  }
  return { rows, ok: rows.every((r) => r.status === "ok" || r.status === "volatile") };
}

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...opts });
  if (r.error) throw r.error;
  return r;
}

const hasDocker = () => {
  try {
    return run("docker", ["version", "--format", "{{.Server.Version}}"]).status === 0;
  } catch {
    return false;
  }
};

const COUNT_SQL = `SET default_transaction_read_only = on;
SELECT format('SELECT %L || chr(9) || count(*) FROM %I.%I;', table_name, table_schema, table_name)
FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name
\\gexec`;

function parseCounts(stdout) {
  const counts = {};
  for (const line of stdout.split(/\r?\n/)) {
    const [table, n] = line.split("\t");
    if (table && n !== undefined && /^\d+$/.test(n.trim())) counts[table] = Number(n);
  }
  return counts;
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(file).on("data", (c) => h.update(c)).on("end", () => resolve(h.digest("hex"))).on("error", reject);
  });
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  loadEnvFile(path.join(root, ".env.backup"));
  const source = process.env.BACKUP_DATABASE_URL?.trim();
  if (!source) throw new Error("BACKUP_DATABASE_URL kerak (direct manzil, db.prisma.io) — .env.backup fayliga yoki muhitga yozing");
  if (/pooled\.db\.prisma\.io|-pooler\./.test(source)) throw new Error("Pooled manzil emas, DIRECT manzil kerak (host db.prisma.io)");

  const docker = process.env.BACKUP_USE_DOCKER === "0" ? false : hasDocker();
  const restoreUrl = process.env.RESTORE_TEST_URL?.trim();
  if (!docker && !restoreUrl) throw new Error("Docker topilmadi: Docker Desktop’ni yoqing yoki RESTORE_TEST_URL (lokal PostgreSQL) bering");
  const fp = databaseFingerprint(source);
  if (restoreUrl && databaseFingerprint(restoreUrl) === fp) throw new Error("RESTORE_TEST_URL manba bazaning o‘zi — boshqa (lokal) server bering");

  const outDir = path.join(root, "backups");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  const name = `auforex-${fp}-${stamp}.dump`;
  const file = path.join(outDir, name);
  const env = { ...process.env, ...pgEnv(source) };
  const pgArgs = (tool, args) => (docker ? ["run", "--rm", "-i", "-e", "PGHOST", "-e", "PGPORT", "-e", "PGUSER", "-e", "PGPASSWORD", "-e", "PGDATABASE", "-e", "PGSSLMODE", "-v", `${outDir}:/backup`, IMAGE, tool, ...args] : args);
  const pg = (tool, args, extra = {}) => run(docker ? "docker" : tool, pgArgs(tool, args), { env, ...extra });

  console.log(`Baza barmoq izi: ${fp}  (production: 85bcf18c856b)`);
  console.log(`Vosita: ${docker ? `Docker (${IMAGE})` : "lokal pg_dump/pg_restore/psql"}`);
  const version = pg("psql", ["-Atc", "SET default_transaction_read_only = on; SHOW server_version;"]);
  if (version.status !== 0) throw new Error(`Bazaga ulanib bo‘lmadi: ${version.stderr.trim().split("\n").pop()}`);
  console.log(`Server: PostgreSQL ${version.stdout.trim().split("\n").pop()}`);

  console.log("1/4 Jadvallar sanalmoqda (faqat o‘qish)…");
  const before = parseCounts(pg("psql", ["-At", "-v", "ON_ERROR_STOP=1"], { input: COUNT_SQL }).stdout);
  if (!Object.keys(before).length) throw new Error("Jadvallar topilmadi — bazani tekshiring");

  console.log(`2/4 pg_dump → backups/${name}`);
  const dump = pg("pg_dump", ["-Fc", "--no-owner", "--no-privileges", "-f", docker ? `/backup/${name}` : file]);
  if (dump.status !== 0 || !existsSync(file) || statSync(file).size === 0) throw new Error(`pg_dump xato: ${dump.stderr.trim().split("\n").pop()}`);
  const size = statSync(file).size;
  const live = parseCounts(pg("psql", ["-At", "-v", "ON_ERROR_STOP=1"], { input: COUNT_SQL }).stdout);

  console.log("3/4 Tiklash sinovi (vaqtinchalik baza)…");
  let restored = {};
  let listed = 0;
  if (docker) {
    const container = `auforex-restore-test-${randomBytes(4).toString("hex")}`;
    const password = randomBytes(12).toString("hex");
    const started = run("docker", ["run", "-d", "--rm", "--name", container, "-e", `POSTGRES_PASSWORD=${password}`, "-v", `${outDir}:/backup:ro`, IMAGE]);
    if (started.status !== 0) throw new Error(`Sinov konteyneri ishga tushmadi: ${started.stderr.trim()}`);
    try {
      for (let i = 0; i < 60; i++) {
        if (run("docker", ["exec", container, "pg_isready", "-U", "postgres"]).status === 0) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      // pg_isready can answer before the init scripts finish; give the server a moment.
      await new Promise((r) => setTimeout(r, 2000));
      listed = (run("docker", ["exec", container, "pg_restore", "--list", `/backup/${name}`]).stdout.match(/TABLE DATA/g) ?? []).length;
      run("docker", ["exec", container, "createdb", "-U", "postgres", "restore_test"]);
      const r = run("docker", ["exec", container, "pg_restore", "-U", "postgres", "-d", "restore_test", "--no-owner", "--no-privileges", "--exit-on-error", `/backup/${name}`]);
      if (r.status !== 0) throw new Error(`pg_restore xato: ${r.stderr.trim().split("\n").pop()}`);
      restored = parseCounts(run("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "restore_test", "-At"], { input: COUNT_SQL }).stdout);
    } finally {
      run("docker", ["rm", "-f", container]);
    }
  } else {
    const target = pgEnv(restoreUrl);
    const scratch = `auforex_restore_test_${randomBytes(4).toString("hex")}`;
    const local = { ...process.env, ...target };
    listed = (run("pg_restore", ["--list", file], { env: local }).stdout.match(/TABLE DATA/g) ?? []).length;
    const created = run("createdb", [scratch], { env: local });
    if (created.status !== 0) throw new Error(`Sinov bazasi yaratilmadi: ${created.stderr.trim()}`);
    try {
      const r = run("pg_restore", ["-d", scratch, "--no-owner", "--no-privileges", "--exit-on-error", file], { env: local });
      if (r.status !== 0) throw new Error(`pg_restore xato: ${r.stderr.trim().split("\n").pop()}`);
      restored = parseCounts(run("psql", ["-d", scratch, "-At"], { env: local, input: COUNT_SQL }).stdout);
    } finally {
      run("dropdb", ["--if-exists", scratch], { env: local });
    }
  }

  console.log("4/4 Taqqoslash…");
  const result = compareCounts(live, restored);
  const digest = await sha256(file);
  const report = {
    file: name,
    sizeBytes: size,
    sha256: digest,
    fingerprint: fp,
    createdAt: new Date().toISOString(),
    tablesInArchive: listed,
    restoreTest: result.ok ? "ok" : "failed",
    tables: result.rows,
  };
  writeFileSync(`${file}.json`, JSON.stringify(report, null, 2));
  for (const r of result.rows) {
    const mark = r.status === "ok" ? "✓" : r.status === "volatile" ? "~" : "✗";
    console.log(`  ${mark} ${r.table.padEnd(28)} baza ${String(r.live ?? "—").padStart(7)} · tiklangan ${String(r.restored ?? "—").padStart(7)}${r.status === "volatile" ? "  (faol jadval, o‘zgarib turadi)" : ""}`);
  }
  console.log(`\nFayl: backups/${name} · ${(size / 1024 / 1024).toFixed(2)} MB · SHA-256 ${digest.slice(0, 16)}…`);
  if (!result.ok) throw new Error("Tiklash sinovida farq bor — zaxira ishonchli emas, qayta urinib ko‘ring");
  console.log(`✓ Zaxira yaroqli: ${result.rows.length} ta jadval tiklandi, qatorlar soni mos. Faylni shifrlangan joyda saqlang.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}
