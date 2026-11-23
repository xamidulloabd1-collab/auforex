import { createHash } from "node:crypto";

/**
 * Bunny Stream videos are embedded with their player:
 *   https://iframe.mediadelivery.net/embed/<library id>/<video id>
 * With "Embed view token authentication" enabled in the Bunny library, a URL only plays when it
 * carries `token` + `expires`, where token = SHA256_HEX(token key + video id + expires).
 * The server signs a short-lived URL for each permitted viewer, so a copied link stops working.
 */
const BUNNY_HOSTS = new Set(["iframe.mediadelivery.net", "player.mediadelivery.net"]);
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Signed links stay valid this long — enough to finish a long lesson with pauses. */
export const BUNNY_TOKEN_TTL_SECONDS = 6 * 60 * 60;

export type BunnyVideo = { host: string; libraryId: string; videoId: string; params: URLSearchParams };

export function isBunnyHost(host: string) {
  return BUNNY_HOSTS.has(host.toLowerCase());
}

/** Parses an embed or play URL from the Bunny dashboard. Old token/expires values are dropped. */
export function parseBunnyUrl(input: string): BunnyVideo | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !isBunnyHost(url.hostname)) return null;
  const [kind, libraryId, videoId, ...rest] = url.pathname.split("/").filter(Boolean);
  if ((kind !== "embed" && kind !== "play") || rest.length) return null;
  if (!libraryId || !/^\d{1,12}$/.test(libraryId) || !videoId || !GUID.test(videoId)) return null;
  const params = new URLSearchParams(url.search);
  params.delete("token");
  params.delete("expires");
  return { host: url.hostname.toLowerCase(), libraryId, videoId: videoId.toLowerCase(), params };
}

function build(v: BunnyVideo, params: URLSearchParams) {
  const qs = params.toString();
  return `https://${v.host}/embed/${v.libraryId}/${v.videoId}${qs ? `?${qs}` : ""}`;
}

/** The URL kept in the database: always the /embed/ form, never with a token. */
export function normalizeBunnyUrl(input: string): string | null {
  const v = parseBunnyUrl(input);
  return v ? build(v, v.params) : null;
}

export function bunnyToken(key: string, videoId: string, expires: number) {
  return createHash("sha256").update(`${key}${videoId}${expires}`).digest("hex");
}

/**
 * Returns the URL a viewer's browser receives. Without a key (token authentication not set up)
 * the plain embed URL is returned; non-Bunny URLs are returned unchanged.
 */
export function signBunnyEmbed(url: string, key: string | undefined, opts: { ttlSeconds?: number; now?: number } = {}) {
  const v = parseBunnyUrl(url);
  if (!v) return url;
  const params = new URLSearchParams(v.params);
  if (key) {
    const expires = Math.floor((opts.now ?? Date.now()) / 1000) + (opts.ttlSeconds ?? BUNNY_TOKEN_TTL_SECONDS);
    params.set("token", bunnyToken(key, v.videoId, expires));
    params.set("expires", String(expires));
  }
  return build(v, params);
}
