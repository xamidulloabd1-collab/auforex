// Low-level PostgreSQL checks shared by `npm run db:fix`, the pre-dev check and doctor.
import net from "node:net";
import pg from "pg";

/** Classifies a connection error into something we can explain and fix. */
export function classifyDbError(err) {
  const first = err instanceof AggregateError && err.errors?.length ? err.errors[0] : err;
  const code = first?.code ?? err?.code;
  const message = String(first?.message || err?.message || err);
  if (code === "28P01" || code === "28000" || /password authentication failed|authentication failed/i.test(message)) return { kind: "auth", message };
  if (code === "3D000" || /database ".*" does not exist/i.test(message)) return { kind: "nodb", message };
  if (code === "ECONNREFUSED" || /ECONNREFUSED/.test(message)) return { kind: "refused", message };
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return { kind: "dns", message };
  if (["ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH"].includes(code) || /timeout|Connection terminated unexpectedly/i.test(message)) return { kind: "timeout", message };
  if (/SSL|TLS|certificate/i.test(message)) return { kind: "tls", message };
  return { kind: "other", message };
}

/** Tries to connect and run `select 1`. Never throws. */
export async function probeDb(url, { timeoutMs = 4000 } = {}) {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: timeoutMs });
  try {
    await client.connect();
    await client.query("select 1");
    return { ok: true, kind: "ok", message: "" };
  } catch (err) {
    return { ok: false, ...classifyDbError(err) };
  } finally {
    await client.end().catch(() => {});
  }
}

export function parseDbUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname.replace(/^\[|\]$/g, ""),
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username || "postgres"),
    password: decodeURIComponent(u.password || ""),
    database: decodeURIComponent(u.pathname.replace(/^\//, "") || "postgres"),
  };
}

export function isLocalHost(host) {
  return ["localhost", "127.0.0.1", "::1"].includes(host);
}

/** Same URL with another host/port (keeps user, password, database and query). */
export function withHostPort(url, host, port) {
  const u = new URL(url);
  u.hostname = host;
  u.port = String(port);
  return u.toString();
}

/** True when something accepts TCP connections on this local port (IPv4 or IPv6). */
export async function portInUse(port) {
  const tryHost = (host) =>
    new Promise((resolve) => {
      const s = net.connect({ host, port });
      const done = (v) => {
        s.destroy();
        resolve(v);
      };
      s.setTimeout(800, () => done(false));
      s.once("connect", () => done(true));
      s.once("error", () => done(false));
    });
  return (await tryHost("127.0.0.1")) || (await tryHost("::1"));
}

/** First local port from `start` that nothing listens on. */
export async function findFreePort(start = 5433, avoid = []) {
  for (let p = start; p < start + 50; p++) {
    if (avoid.includes(p)) continue;
    if (!(await portInUse(p))) return p;
  }
  throw new Error("Bo‘sh port topilmadi");
}

/** Uzbek explanation for a failed probe. */
export function explainDbFailure(kind, { host, port, user } = {}) {
  switch (kind) {
    case "auth":
      return `${host}:${port} dagi PostgreSQL “${user}” uchun parolni qabul qilmadi. Bu port’da boshqa PostgreSQL (masalan, Windows’ga o‘rnatilgani) ishlayotgan bo‘lishi yoki Docker bazasining paroli boshqacha bo‘lishi mumkin.`;
    case "refused":
      return isLocalHost(host)
        ? `${host}:${port} da PostgreSQL ishlamayapti (Docker Desktop yopiq yoki baza konteyneri to‘xtagan).`
        : `${host}:${port} ulanishni rad etdi: manzil yoki port noto‘g‘ri, yoki u serverda PostgreSQL ishlamayapti.`;
    case "nodb":
      return "PostgreSQL ishlayapti, lekin DATABASE_URL’dagi baza hali yaratilmagan.";
    case "dns":
      return "DATABASE_URL’dagi server manzili topilmadi.";
    case "timeout":
      return isLocalHost(host)
        ? `${host}:${port} javob bermadi (vaqt tugadi): PostgreSQL ishga tushayotgan yoki osilib qolgan bo‘lishi mumkin.`
        : `${host}:${port} javob bermadi (vaqt tugadi). Bu kompyuterdan shu serverga ulanish yo‘q: internet/provayder yoki firewall ${port}-portni yopgan, VPN kerak, yoki manzil noto‘g‘ri. Tekshirish (PowerShell): Test-NetConnection ${host} -Port ${port}`;
    case "tls":
      return `${host}:${port} bilan xavfsiz (SSL) ulanish o‘rnatilmadi. URL oxiridagi sslmode sozlamasini tekshiring.`;
    default:
      return "Bazaga ulanishda kutilmagan xato.";
  }
}
