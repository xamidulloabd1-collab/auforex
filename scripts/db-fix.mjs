// Finds and fixes the most common local database problems, without deleting any data:
//   npm run db:fix
//
// 1. If the DATABASE_URL in .env already works → nothing to do.
// 2. Makes sure this project's Docker database (docker compose service "db") is running —
//    on a free port if another PostgreSQL already occupies the configured one.
// 3. Connects to the Docker database with the login from .env. If the Docker database has a
//    different password, the password is set from inside the container (data is untouched).
// 4. If the login is still rejected, another PostgreSQL answers on that port → the Docker
//    database is moved to a free port (data stays in the Docker volume).
// 5. Creates the database if it is missing and writes the working DATABASE_URL / DB_PORT to .env.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getEnvValue, setEnvValue } from "./lib/env-file.mjs";
import { explainDbFailure, findFreePort, isLocalHost, parseDbUrl, portInUse, probeDb, withHostPort } from "./lib/db-probe.mjs";

const root = process.cwd();
const envPath = path.join(root, ".env");
const say = (s = "") => console.log(s);
const ok = (s) => say(`✓ ${s}`);
const info = (s) => say(`• ${s}`);
const fail = (s) => {
  say(`\n✗ ${s}\n`);
  process.exit(1);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function docker(args, { quiet = true } = {}) {
  const r = spawnSync("docker", args, { cwd: root, encoding: "utf8", stdio: quiet ? "pipe" : "inherit" });
  return { status: r.error ? -1 : r.status, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() || String(r.error ?? "") };
}

function readEnv() {
  if (!existsSync(envPath)) fail(".env fayli yo‘q. Avval:  npm run setup");
  return readFileSync(envPath, "utf8");
}

function saveEnv(updates) {
  let text = readEnv();
  for (const [k, v] of Object.entries(updates)) text = setEnvValue(text, k, v);
  writeFileSync(envPath, text);
}

function composePort() {
  const r = docker(["compose", "port", "db", "5432"]);
  if (r.status !== 0 || !r.out) return null;
  const m = r.out.split(/\r?\n/)[0].match(/:(\d+)$/);
  return m ? Number(m[1]) : null;
}

function dbRunning() {
  const r = docker(["compose", "ps", "-q", "--status", "running", "db"]);
  return r.status === 0 && r.out.length > 0;
}

async function waitReady(port, url) {
  for (let i = 0; i < 40; i++) {
    const r = docker(["compose", "exec", "-T", "db", "pg_isready", "-U", "postgres"]);
    if (r.status === 0) {
      // the server may still restart after first-time initialisation; wait for TCP to answer too
      const p = await probeDb(withHostPort(url, "127.0.0.1", port), { timeoutMs: 2000 });
      if (p.kind !== "refused" && p.kind !== "timeout") return true;
    }
    await sleep(1000);
  }
  return false;
}

async function startDb(port, url) {
  info(`Docker bazasini ${port}-portda ishga tushiryapman…`);
  saveEnv({ DB_PORT: String(port) });
  const r = spawnSync("docker", ["compose", "up", "-d", "db"], { cwd: root, encoding: "utf8", env: { ...process.env, DB_PORT: String(port) } });
  const errText = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.status !== 0) return { ok: false, portBusy: /already allocated|address already in use|ports are not available|bind/i.test(errText), message: errText.trim() };
  return { ok: await waitReady(port, url), portBusy: false, message: "" };
}

function psqlInContainer(sql) {
  return docker(["compose", "exec", "-T", "db", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tAc", sql]);
}

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const ident = (s) => `"${String(s).replace(/"/g, '""')}"`;

async function main() {
  say("\nAU Forex Academy — ma’lumotlar bazasini tekshirish va tuzatish\n");
  const text = readEnv();
  const url = process.env.DATABASE_URL || getEnvValue(text, "DATABASE_URL");
  if (!url) fail(".env’da DATABASE_URL yo‘q. Avval:  npm run setup");
  let cfg;
  try {
    cfg = parseDbUrl(url);
  } catch {
    fail(`DATABASE_URL noto‘g‘ri yozilgan: ${url}`);
  }

  // 1. Already fine?
  const first = await probeDb(url);
  if (first.ok) {
    ok(`Bazaga ulanish ishlayapti (${cfg.host}:${cfg.port}/${cfg.database}). Tuzatish shart emas.`);
    return nextSteps(url);
  }
  info(explainDbFailure(first.kind, cfg));

  if (!isLocalHost(cfg.host)) {
    fail("DATABASE_URL boshqa serverga qaragan — uni avtomatik tuzatib bo‘lmaydi. Login, parol va manzilni hosting/baza panelidan tekshiring.");
  }

  // 2. Docker available?
  const ver = docker(["compose", "version"]);
  if (ver.status !== 0) {
    fail(
      "Docker topilmadi. Docker Desktop’ni o‘rnating/oching va qayta ishga tushiring:  npm run db:fix\n" +
        "  Docker’siz ishlatsangiz: .env’dagi DATABASE_URL’ga o‘z PostgreSQL’ingizning login, parol va portini yozing.",
    );
  }
  const ps = docker(["compose", "ps", "-q", "db"]);
  if (ps.status !== 0) {
    fail(`Docker ishlamayapti: ${ps.err.split("\n")[0]}\n  Docker Desktop’ni oching, “Engine running” bo‘lishini kuting va qayta:  npm run db:fix`);
  }

  // 3. Make sure the project's database container runs
  let port = dbRunning() ? composePort() : null;
  if (port) ok(`Docker bazasi ishlayapti: 127.0.0.1:${port}`);
  else {
    let want = Number(getEnvValue(readEnv(), "DB_PORT") || cfg.port || 5432);
    if (await portInUse(want)) {
      const free = await findFreePort(5433, [want]);
      info(`${want}-port band (u yerda boshqa PostgreSQL ishlayapti) → Docker bazasi uchun ${free}-port tanlandi.`);
      want = free;
    }
    let started = await startDb(want, url);
    if (!started.ok && started.portBusy) {
      const free = await findFreePort(want + 1, [want]);
      info(`${want}-port band ekan → ${free}-port bilan qayta urinyapman.`);
      want = free;
      started = await startDb(want, url);
    }
    if (!started.ok) fail(`Docker bazasini ishga tushirib bo‘lmadi.\n${started.message}`);
    port = want;
    ok(`Docker bazasi ishga tushdi: 127.0.0.1:${port}`);
  }

  // 4. Connect to the Docker database with the .env login
  let candidate = withHostPort(url, "127.0.0.1", port);
  let res = await probeDb(candidate);

  if (res.kind === "auth") {
    info(`Docker bazasidagi “${cfg.user}” paroli .env bilan bir xil emas → .env’dagi parolni o‘rnatyapman (ma’lumotlar o‘zgarmaydi).`);
    const sql =
      `DO $$ BEGIN IF EXISTS (SELECT FROM pg_roles WHERE rolname = ${lit(cfg.user)}) ` +
      `THEN EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', ${lit(cfg.user)}, ${lit(cfg.password)}); ` +
      `ELSE EXECUTE format('CREATE ROLE %I WITH LOGIN SUPERUSER PASSWORD %L', ${lit(cfg.user)}, ${lit(cfg.password)}); END IF; END $$;`;
    const r = psqlInContainer(sql);
    if (r.status !== 0) fail(`Parolni o‘rnatib bo‘lmadi: ${r.err || r.out}`);
    res = await probeDb(candidate);
  }

  if (res.kind === "auth") {
    // Another server answers on this port (e.g. PostgreSQL installed on Windows).
    const free = await findFreePort(5433, [port]);
    info(`${port}-portga boshqa PostgreSQL javob beryapti → Docker bazasini ${free}-portga ko‘chiryapman (ma’lumotlar Docker volume’da saqlanadi).`);
    const started = await startDb(free, url);
    if (!started.ok) fail(`Docker bazasini ${free}-portda ishga tushirib bo‘lmadi.\n${started.message}`);
    port = free;
    candidate = withHostPort(url, "127.0.0.1", port);
    res = await probeDb(candidate);
  }

  if (res.kind === "nodb") {
    info(`“${cfg.database}” bazasi yo‘q → yaratyapman.`);
    const r = psqlInContainer(`CREATE DATABASE ${ident(cfg.database)} OWNER ${ident(cfg.user)}`);
    if (r.status !== 0) fail(`Bazani yaratib bo‘lmadi: ${r.err || r.out}`);
    res = await probeDb(candidate);
  }

  if (!res.ok) fail(`${explainDbFailure(res.kind, { ...cfg, host: "127.0.0.1", port })}\n  Tafsilot: ${res.message}`);

  saveEnv({ DATABASE_URL: candidate, DB_PORT: String(port) });
  ok(`Ulanish ishlayapti: 127.0.0.1:${port}/${cfg.database}`);
  ok(`.env yangilandi: DATABASE_URL va DB_PORT="${port}"`);
  return nextSteps(candidate);
}

async function nextSteps(url) {
  const pgmod = (await import("pg")).default;
  const client = new pgmod.Client({ connectionString: url, connectionTimeoutMillis: 4000 });
  let migrated = 0;
  let users = 0;
  try {
    await client.connect();
    const t = await client.query(`SELECT to_regclass('public."_prisma_migrations"') AS m, to_regclass('public."User"') AS u`);
    if (t.rows[0]?.m) migrated = Number((await client.query(`SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`)).rows[0].n);
    if (t.rows[0]?.u) users = Number((await client.query(`SELECT count(*)::int AS n FROM "User"`)).rows[0].n);
  } catch {
    /* ignore — only for the hint below */
  } finally {
    await client.end().catch(() => {});
  }
  say("");
  if (users > 0) info(`Bazada ${users} ta foydalanuvchi bor — avvalgi ma’lumotlaringiz joyida.`);
  say("Keyingi qadamlar:");
  say(`  npx prisma migrate deploy${migrated ? "" : "        (jadvallar hali yo‘q)"}`);
  say("  npm run db:seed");
  say("  npm run founder:password");
  say("  npm run dev");
  say("");
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
