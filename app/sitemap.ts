import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicSiteUrl();
  const pages = ["", "/lessons", "/books", "/tradingview", "/challenge", "/founder", "/subscription", "/login", "/register"];
  return pages.map((p) => ({ url: `${base}${p}`, changeFrequency: p === "" ? "weekly" : "monthly", priority: p === "" ? 1 : 0.6 }));
}
