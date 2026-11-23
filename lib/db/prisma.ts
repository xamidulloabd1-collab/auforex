import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "./generated/client";

/**
 * One PrismaClient + one small pg pool per server instance.
 *
 * Vercel runs many instances at once; each keeps its own pool, so the total number of database
 * connections is roughly (instances × pool size). Prisma Postgres answers "P2037: Too many
 * database connections opened" when that total passes its limit. Therefore:
 *  - app traffic uses the pooled address when the host provides one (DATABASE_URL_POOLED from
 *    the Prisma Postgres integration); migrations keep the direct DATABASE_URL (prisma.config.ts);
 *  - the pool is small on Vercel (2 by default, DB_POOL_MAX to change) and idle connections are
 *    closed after 5 s;
 *  - attachDatabasePool lets Vercel keep a suspended instance alive just long enough to close
 *    its idle connections instead of leaving them open on the database.
 */
type Instance = PrismaClient;

const globalForPrisma = globalThis as unknown as { prisma?: Instance; prismaPool?: Pool; prismaUrl?: string };

export function runtimeDatabaseUrl(source: Record<string, string | undefined> = process.env) {
  return source.DATABASE_URL_POOLED || source.DATABASE_URL || undefined;
}

/** "host:port/database (VARIABLE)" of the database the site uses — never the login or password. */
export function databaseTarget(source: Record<string, string | undefined> = process.env) {
  const key = source.DATABASE_URL_POOLED ? "DATABASE_URL_POOLED" : "DATABASE_URL";
  const raw = source[key];
  if (!raw) return `${key} o‘rnatilmagan`;
  try {
    const u = new URL(raw);
    return `${u.hostname}:${u.port || "5432"}${u.pathname} (${key})`;
  } catch {
    return `${key} noto‘g‘ri yozilgan`;
  }
}

export function poolSize(source: Record<string, string | undefined> = process.env) {
  const configured = Number(source.DB_POOL_MAX);
  if (Number.isInteger(configured) && configured > 0 && configured <= 50) return configured;
  return source.VERCEL === "1" ? 2 : 10;
}

function createPool(connectionString: string | undefined) {
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const serverless = process.env.VERCEL === "1";
  const pool = new Pool({
    connectionString,
    max: poolSize(),
    idleTimeoutMillis: serverless ? 5_000 : 30_000,
    connectionTimeoutMillis: 10_000,
    // Recycle long-lived connections so a pooler restart never leaves stale sockets around.
    maxLifetimeSeconds: serverless ? 60 : 0,
  });
  // An idle connection dropped by the server emits "error" on the pool; without a listener
  // Node would crash the whole instance.
  pool.on("error", (err) => console.error("[db] idle connection error:", err.message));
  if (serverless) attachDatabasePool(pool);
  return pool;
}

function createPrismaClient(pool: Pool): Instance {
  return new PrismaClient({
    adapter: new PrismaPg(pool),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export function getPrisma(): Instance {
  const url = runtimeDatabaseUrl();
  if (globalForPrisma.prisma && globalForPrisma.prismaUrl !== url) {
    // The database address changed while the server was running (an .env file edited during
    // `npm run dev`): close the old connections and use the new address — no restart needed.
    const old = globalForPrisma.prismaPool;
    globalForPrisma.prisma = undefined;
    globalForPrisma.prismaPool = undefined;
    void old?.end().catch(() => {});
  }
  if (!globalForPrisma.prisma) {
    const pool = createPool(url);
    globalForPrisma.prismaPool = pool;
    globalForPrisma.prisma = createPrismaClient(pool);
    globalForPrisma.prismaUrl = url;
  }
  return globalForPrisma.prisma;
}

/** Lazy proxy: importing this module never opens a connection (keeps `next build` DB-free). */
export const prisma: Instance = new Proxy({} as Instance, {
  get(_target, prop) {
    const client = getPrisma();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
