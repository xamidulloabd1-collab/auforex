import "server-only";

/** Prisma / driver error codes that mean the database schema is not in place yet. */
const SCHEMA_MISSING = /P2021|P2022|TableDoesNotExist|ColumnNotFound|does not exist in the current database/i;
/** …and the ones that mean the database cannot be reached or rejects the credentials. */
const UNREACHABLE =
  /P1000|P1001|P1002|P1017|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH|ENETUNREACH|Can't reach database server|Authentication failed|password authentication failed|timeout exceeded when trying to connect|Connection terminated|DATABASE_URL is not set/i;

function describe(err: unknown): string {
  if (!err || typeof err !== "object") return String(err);
  const e = err as { code?: unknown; message?: unknown; cause?: unknown };
  return `${String(e.code ?? "")} ${String(e.message ?? "")} ${e.cause ? describe(e.cause) : ""}`;
}

export function databaseProblem(err: unknown): "schema" | "unreachable" | null {
  const text = describe(err);
  if (SCHEMA_MISSING.test(text)) return "schema";
  if (UNREACHABLE.test(text)) return "unreachable";
  return null;
}

/**
 * Runs a read used only to decorate a public page. If it fails, the page still renders with
 * `fallback`, and the server log says exactly what to fix — the error is never swallowed silently.
 */
export async function withFallback<T>(label: string, read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (err) {
    const problem = databaseProblem(err);
    const hint =
      problem === "schema"
        ? " — jadvallar yo‘q: migratsiyalarni qo‘llang (npx prisma migrate deploy)"
        : problem === "unreachable"
          ? " — ma’lumotlar bazasiga ulanib bo‘lmadi (lokal: npm run doctor; Vercel: DATABASE_URL va /api/health)"
          : "";
    console.error(`[data] "${label}" o‘qilmadi${hint}`, err);
    return fallback;
  }
}
