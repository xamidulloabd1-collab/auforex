import { prisma } from "@/lib/db/prisma";
import { checkEnv } from "@/lib/env";
import { ModelName } from "@/lib/db/generated/internal/prismaNamespaceBrowser";
import { appUrl } from "@/lib/env";
import { storageStatus } from "@/lib/storage";
import { poolSize } from "@/lib/db/prisma";

/** Which address sign-in links use, and whether this request came to the same one (no secrets). */
function siteReport(request: Request) {
  const configured = appUrl();
  const requested = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const configuredHost = new URL(configured).host;
  return {
    url: configured,
    https: configured.startsWith("https://"),
    matchesRequest: configuredHost === requested.split(",")[0]?.trim(),
    warning:
      process.env.NODE_ENV === "production" && configuredHost.startsWith("localhost")
        ? "Sayt manzili localhost — NEXT_PUBLIC_APP_URL ni https://… qilib o‘rnating (email havolalari shu manzilga ketadi)"
        : undefined,
  };
}

/** Kind of connection failure (no addresses or credentials). */
function connectionFailure(err: unknown): "timeout" | "auth" | "dns" | "refused" | "config" | "other" {
  const text = `${err instanceof Error ? err.message : String(err)} ${String((err as { cause?: unknown })?.cause ?? "")}`;
  if (/timeout|Connection terminated|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH/i.test(text)) return "timeout";
  if (/password authentication failed|28P01|Authentication failed|P1000/i.test(text)) return "auth";
  if (/ENOTFOUND|EAI_AGAIN/i.test(text)) return "dns";
  if (/ECONNREFUSED/i.test(text)) return "refused";
  if (/DATABASE_URL is not set/i.test(text)) return "config";
  return "other";
}

/** Connection mode only — never the address or credentials. */
function databaseReport() {
  const pooled = Boolean(process.env.DATABASE_URL_POOLED);
  let directPrismaPostgres = false;
  try {
    directPrismaPostgres = !pooled && new URL(process.env.DATABASE_URL ?? "").hostname === "db.prisma.io";
  } catch {}
  return {
    pooled,
    poolMax: poolSize(),
    hint: directPrismaPostgres
      ? "DATABASE_URL_POOLED o‘rnating: DATABASE_URL bilan bir xil, faqat host pooled.db.prisma.io (docs/VERCEL.md)"
      : undefined,
  };
}

function storageReport() {
  const s = storageStatus();
  return { driver: s.driver, uploads: s.uploads ? "ok" : "not_configured" };
}

/**
 * Liveness + configuration check: open /api/health after a deploy.
 *   200 { status: "ok" }                       — database reachable, every table in place
 *   503 { status: "schema_missing", … }         — migrations not applied (run prisma migrate deploy)
 *   503 { status: "database_unavailable" }      — DATABASE_URL wrong or the database is down
 *   503 { status: "config_invalid", … }         — required settings missing (names only, never values)
 */
export const dynamic = "force-dynamic";

const EXPECTED_TABLES = Object.values(ModelName);

export async function GET(request: Request) {
  const headers = { "cache-control": "no-store" };

  const config = checkEnv(process.env);
  if (!config.ok) {
    // Only the variable names are returned; the details go to the server log.
    console.error("[health] invalid configuration:\n" + config.issues.join("\n"));
    const variables = [...new Set(config.issues.map((i) => i.split(":")[0]))];
    return Response.json({ status: "config_invalid", variables }, { status: 503, headers });
  }

  try {
    const rows = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = ANY(${[...EXPECTED_TABLES, "_prisma_migrations"]})`;
    const present = new Set(rows.map((r) => r.table_name));
    const missing = EXPECTED_TABLES.filter((t) => !present.has(t));
    let migrationsApplied = 0;
    if (present.has("_prisma_migrations")) {
      const [row] = await prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
      migrationsApplied = row?.n ?? 0;
    }
    if (missing.length) {
      return Response.json(
        { status: "schema_missing", missingTables: missing, migrationsApplied, fix: "npx prisma migrate deploy" },
        { status: 503, headers },
      );
    }
    return Response.json({ status: "ok", migrationsApplied, site: siteReport(request), database: databaseReport(), storage: storageReport() }, { headers });
  } catch (err) {
    console.error("[health] database check failed", err);
    return Response.json(
      { status: "database_unavailable", reason: connectionFailure(err), database: databaseReport() },
      { status: 503, headers },
    );
  }
}
