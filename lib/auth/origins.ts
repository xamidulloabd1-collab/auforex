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
