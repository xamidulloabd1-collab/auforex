import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { classifyDbError, explainDbFailure, probeDb } from "../../scripts/lib/db-probe.mjs";
import {
  describeDbUrl,
  describeEnv,
  dotEnvOverrideWarnings,
  envFilesFor,
  explainMissing,
} from "../../scripts/lib/env-load.mjs";
import { missingPackages } from "../../scripts/lib/packages.mjs";
import { databaseProblem } from "../../lib/data/safe";

const dirs: string[] = [];
function project(files: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), "auf-env-"));
  dirs.push(dir);
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), text);
  }
  return dir;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const SECRET = "s".repeat(48);
const KEYS = ["BETTER_AUTH_SECRET", "DATABASE_URL"];

describe(".env files are read the way Next.js reads them", () => {
  it("uses Next.js order: npm run dev never reads .env.production.local", () => {
    expect(envFilesFor("development")).toEqual([".env.development.local", ".env.local", ".env.development", ".env"]);
    expect(envFilesFor("production")).toEqual([".env.production.local", ".env.local", ".env.production", ".env"]);
  });

  it("an empty value in .env.local hides the real one in .env (the “BETTER_AUTH_SECRET is required” case)", () => {
    const root = project({ ".env": `BETTER_AUTH_SECRET="${SECRET}"\n`, ".env.local": 'BETTER_AUTH_SECRET=""\n' });
    const { files, keys } = describeEnv({ root, mode: "development", keys: KEYS, initialEnv: {} });
    expect(files).toEqual([".env.local", ".env"]);
    expect(keys.BETTER_AUTH_SECRET).toEqual({ state: "empty", source: ".env.local", shadows: ".env", ignoredIn: [] });
    const text = explainMissing("BETTER_AUTH_SECRET", keys.BETTER_AUTH_SECRET!, "development");
    expect(text).toMatch(/\.env\.local faylida bo‘sh va \.env dagi qiymatni bekor qilmoqda/);
    expect(text).not.toContain(SECRET);
  });

  it("a value only in .env.production.local is reported as not read by npm run dev", () => {
    const root = project({ ".env.production.local": `BETTER_AUTH_SECRET="${SECRET}"\n` });
    const dev = describeEnv({ root, mode: "development", keys: KEYS, initialEnv: {} });
    expect(dev.keys.BETTER_AUTH_SECRET).toMatchObject({ state: "missing", source: null, ignoredIn: [".env.production.local"] });
    expect(explainMissing("BETTER_AUTH_SECRET", dev.keys.BETTER_AUTH_SECRET!, "development")).toMatch(/“npm run dev” bu faylni o‘qimaydi/);
    const prod = describeEnv({ root, mode: "production", keys: KEYS, initialEnv: {} });
    expect(prod.keys.BETTER_AUTH_SECRET).toMatchObject({ state: "set", source: ".env.production.local" });
  });

  it("variables set in the shell / on Vercel win over every file", () => {
    const root = project({ ".env": 'DATABASE_URL="postgresql://a:b@localhost:5432/x"\n' });
    const { keys } = describeEnv({ root, mode: "development", keys: KEYS, initialEnv: { DATABASE_URL: "postgresql://c:d@db.prisma.io:5432/y" } });
    expect(keys.DATABASE_URL).toMatchObject({ state: "set", source: "environment" });
  });

  it("loads into process.env exactly like Next.js (child process, nothing leaks into this test)", () => {
    const root = project({
      ".env": `BETTER_AUTH_SECRET="${SECRET}"\nDATABASE_URL="postgresql://u:p@localhost:5432/from_env"\n`,
      ".env.local": 'DATABASE_URL="postgresql://u:p@localhost:5432/from_local"\n',
      ".env.production.local": 'DATABASE_URL="postgresql://u:p@localhost:5432/from_prod_local"\n',
    });
    const loader = path.resolve("scripts/lib/env-load.mjs");
    const script = `const m = await import(${JSON.stringify(loader)}); const files = m.loadProjectEnv(${JSON.stringify(root)}, process.argv[1]); console.log(JSON.stringify({ files, db: process.env.DATABASE_URL.split("/").pop() }));`;
    const run = (mode: string) =>
      JSON.parse(
        execFileSync(process.execPath, ["--input-type=module", "-e", script, mode], {
          env: { PATH: process.env.PATH ?? "", NODE_ENV: "development" },
          encoding: "utf8",
        }),
      );
    expect(run("development")).toEqual({ files: [".env.local", ".env"], db: "from_local" });
    expect(run("production")).toEqual({ files: [".env.production.local", ".env.local", ".env"], db: "from_prod_local" });
  });

  it("warns when setup/db:fix write to .env but .env.local overrides it", () => {
    const root = project({ ".env": "", ".env.local": 'DATABASE_URL=""\nOTHER="1"\n' });
    const lines = dotEnvOverrideWarnings(root, ["DATABASE_URL", "BETTER_AUTH_SECRET"]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^\.env\.local dagi DATABASE_URL \(bo‘sh\) \.env dagisidan ustun turadi/);
  });
});

describe("database address is described without credentials", () => {
  it("never includes the login or password", () => {
    const d = describeDbUrl("postgresql://user:Sup3r-Secret@db.prisma.io:5432/postgres?sslmode=require");
    expect(d).toEqual({ target: "db.prisma.io:5432/postgres", host: "db.prisma.io", port: 5432, kind: "prisma-direct" });
    expect(JSON.stringify(d)).not.toMatch(/Sup3r|user/);
    expect(describeDbUrl("postgres://u:p@pooled.db.prisma.io:5432/postgres").kind).toBe("prisma-pooled");
    expect(describeDbUrl("postgresql://u:p@127.0.0.1:5433/auforex").kind).toBe("local");
    expect(describeDbUrl("prisma+postgres://accelerate.prisma-data.net/?api_key=x").kind).toBe("accelerate");
  });
});

describe("connection timeouts are recognised", () => {
  it("pg pool / client timeout messages count as “database unreachable”", () => {
    expect(databaseProblem(new Error("timeout exceeded when trying to connect"))).toBe("unreachable");
    const nested = new Error("Connection terminated due to connection timeout", { cause: new Error("Connection terminated unexpectedly") });
    expect(databaseProblem(nested)).toBe("unreachable");
    expect(databaseProblem(new Error("Unique constraint failed"))).toBeNull();
    expect(classifyDbError(new Error("timeout exceeded when trying to connect")).kind).toBe("timeout");
    expect(classifyDbError({ code: "EHOSTUNREACH", message: "connect EHOSTUNREACH" }).kind).toBe("timeout");
  });

  it("explains a remote timeout with a concrete check, a local one without Docker advice for remote hosts", () => {
    expect(explainDbFailure("timeout", { host: "db.prisma.io", port: 5432 })).toMatch(/Test-NetConnection db\.prisma\.io -Port 5432/);
    expect(explainDbFailure("refused", { host: "db.example.com", port: 5432 })).not.toMatch(/Docker/);
  });

  it("a port that accepts TCP but never answers is reported as a timeout, not a hang", async () => {
    const net = await import("node:net");
    const server = net.createServer(() => {});
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const port = (server.address() as { port: number }).port;
    const started = Date.now();
    const res = await probeDb(`postgresql://u:p@127.0.0.1:${port}/x`, { timeoutMs: 800 });
    server.close();
    expect(res).toMatchObject({ ok: false, kind: "timeout" });
    expect(Date.now() - started).toBeLessThan(5000);
  });
});

describe("dependencies", () => {
  it("lists packages from package.json that npm install has not installed yet", () => {
    const root = project({
      "package.json": JSON.stringify({ dependencies: { "@vercel/functions": "^3", pg: "^8" }, devDependencies: { tsx: "^4" } }),
      "node_modules/pg/package.json": "{}",
    });
    expect(missingPackages(root)).toEqual(["@vercel/functions", "tsx"]);
    expect(missingPackages(root, { dev: false })).toEqual(["@vercel/functions"]);
  });
});
