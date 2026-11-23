import { VIDEO_EMBED_HOSTS } from "@/lib/constants";
import { isBunnyHost, normalizeBunnyUrl } from "@/lib/video/bunny";

/**
 * Normalises an external video URL to an allow-listed embed URL.
 * Supports YouTube (watch / youtu.be / embed), Vimeo and Bunny Stream embed/play URLs.
 * Returns null for anything else.
 */
export function normalizeEmbedUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com" || host === "www.youtube-nocookie.com") {
    let id: string | null = null;
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/live/")) id = url.pathname.split("/")[2] ?? null;
    return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "vimeo.com" || host === "www.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }
  // Bunny Stream: only real embed/play links (library + video id); stored without any token.
  if (isBunnyHost(host)) return normalizeBunnyUrl(input);
  if ((VIDEO_EMBED_HOSTS as readonly string[]).includes(host)) {
    return `https://${host}${url.pathname}${url.search}`;
  }
  return null;
}
