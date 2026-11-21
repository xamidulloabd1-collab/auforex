import path from "node:path";
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Security headers applied to every response.
 * The Content-Security-Policy (with a per-request nonce) is set in `proxy.ts`.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

/**
 * Development only: lets phones/tablets on the same Wi-Fi open the dev server
 * (http://192.168.x.x:3000) with hot reload. Ignored by `next start`.
 */
const lanDevOrigins = ["192.168.*.*", "10.*.*.*", "172.*.*.*", "127.0.0.1"];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // This folder is the project root, even if a package-lock.json exists higher up (e.g. C:\Users\<you>).
  turbopack: { root: path.resolve(__dirname) },
  outputFileTracingRoot: path.resolve(__dirname),
  allowedDevOrigins: lanDevOrigins,
  // The floating dev badge covered the phone tab bar and reader buttons. Errors still open the overlay.
  devIndicators: false,
  reactStrictMode: true,
  typedRoutes: false,
  images: {
    formats: ["image/avif", "image/webp"],
    localPatterns: [{ pathname: "/api/media/**" }, { pathname: "/images/**" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  /** The panel lives at /super-admin; common spellings and the removed /admin panel lead there. */
  async redirects() {
    return ["/superadmin", "/super_admin", "/admin"].map((source) => ({
      source: `${source}/:path*`,
      destination: "/super-admin/:path*",
      permanent: false,
    }));
  },
};

export default nextConfig;
