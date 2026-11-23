/**
 * Origins allowed to call the auth API.
 *
 * Production: only the configured site URL plus TRUSTED_ORIGINS.
 * Development: additionally the dev server opened from this computer or from a phone on
 * the same Wi-Fi (http://localhost, http://127.0.0.1, http://192.168.x.x, 10.x, 172.16–31.x),
 * so sign-in works when testing on a real device.
 */
const PRIVATE_HOST = /^(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/;

export function devLanOrigin(origin: string | null | undefined, nodeEnv: string | undefined): string | null {
  if (nodeEnv === "production" || !origin) return null;
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" || !PRIVATE_HOST.test(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * The site's own origin for this request (scheme + host the browser used), so sign-in works on
 * every address the site is served from (vercel.app, a custom domain, preview URLs) without
 * listing them. Only a request whose Origin header equals that address matches it — a page on
 * another site sends its own origin and is still rejected (CSRF protection stays intact).
 */
export function requestOwnOrigin(request: Request | undefined | null): string | null {
  if (!request) return null;
  const headers = request.headers;
  const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? "").split(",")[0]!.trim();
  if (!host || !/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) return null;
  let proto = (headers.get("x-forwarded-proto") ?? "").split(",")[0]!.trim().toLowerCase();
  if (proto !== "http" && proto !== "https") {
    try {
      proto = new URL(request.url).protocol.replace(":", "");
    } catch {
      return null;
    }
  }
  const own = `${proto}://${host.toLowerCase()}`;
  const origin = headers.get("origin");
  return origin && origin.toLowerCase() === own ? own : null;
}
