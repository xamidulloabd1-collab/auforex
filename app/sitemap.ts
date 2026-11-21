import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const pages = ["", "/lessons", "/books", "/tradingview", "/challenge", "/founder", "/subscription", "/login", "/register"];
  return pages.map((p) => ({ url: `${base}${p}`, changeFrequency: p === "" ? "weekly" : "monthly", priority: p === "" ? 1 : 0.6 }));
}
