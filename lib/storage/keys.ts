/**
 * Storage key conventions. Keys are generated server-side only and look like
 * `<area>/<32 hex chars>.<ext>` — anything else is rejected (no path traversal).
 */
export const STORAGE_AREAS = [
  "videos",
  "books",
  "submissions",
  "covers",
  "thumbnails",
  "avatars",
  "founder",
] as const;

export type StorageArea = (typeof STORAGE_AREAS)[number];

/** Areas that may be served without authentication (non-sensitive imagery). */
export const PUBLIC_AREAS: ReadonlySet<StorageArea> = new Set([
  "covers",
  "thumbnails",
  "avatars",
  "founder",
]);

const KEY_PATTERN = /^(videos|books|submissions|covers|thumbnails|avatars|founder)\/[a-f0-9]{32}\.(mp4|webm|pdf|png|jpg|webp)$/;

/**
 * Read-only files shipped with the app (the seeded books and covers in `prisma/seed-assets`).
 * Used on hosts whose disk is read-only (Vercel): `bundled/books/<name>.pdf`.
 */
const BUNDLED_PATTERN = /^bundled\/(books|covers)\/[a-z0-9][a-z0-9-]{0,99}\.(pdf|png|jpg|webp)$/;

export function isBundledKey(key: string): boolean {
  return BUNDLED_PATTERN.test(key);
}

export function isValidStorageKey(key: string): boolean {
  return KEY_PATTERN.test(key) || BUNDLED_PATTERN.test(key);
}

export function areaOf(key: string): StorageArea | null {
  if (KEY_PATTERN.test(key)) return key.split("/")[0] as StorageArea;
  if (BUNDLED_PATTERN.test(key)) return key.split("/")[1] as StorageArea;
  return null;
}

export function isPublicKey(key: string) {
  const area = areaOf(key);
  return area != null && PUBLIC_AREAS.has(area);
}

export function newStorageKey(area: StorageArea, ext: string) {
  const id = crypto.randomUUID().replace(/-/g, "");
  return `${area}/${id}.${ext}`;
}

/** URL for public imagery (served by /api/media). Private keys never get a URL. */
export function publicMediaUrl(key: string | null | undefined) {
  if (!key || !isPublicKey(key)) return null;
  return `/api/media/${key}`;
}
