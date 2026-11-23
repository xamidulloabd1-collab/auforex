import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = publicSiteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/super-admin", "/dashboard", "/api/", "/reset-password", "/verify-email"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
