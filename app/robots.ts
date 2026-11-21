import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/super-admin", "/dashboard", "/api/", "/reset-password", "/verify-email"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
