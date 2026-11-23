import { vercelSiteHost } from "./env-schema";

/** Public site address for metadata, robots.txt and the sitemap (no trailing slash). */
export function publicSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const host = vercelSiteHost(process.env);
  return host ? `https://${host}` : "http://localhost:3000";
}
