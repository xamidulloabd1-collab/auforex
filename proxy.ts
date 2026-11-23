import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Edge of the request pipeline:
 *  1. Sets a per-request nonce-based Content-Security-Policy.
 *  2. Optimistically redirects guests away from /dashboard and /super-admin.
 *     (Real authorization happens server-side in every page, action and route handler.)
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const needsSession = pathname.startsWith("/dashboard") || pathname.startsWith("/super-admin");
  if (needsSession && !getSessionCookie(request, { cookiePrefix: "auf" })) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const isHttps = (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");
  // Object storage (R2/S3): the browser uploads to it and plays videos from short-lived links.
  const storage = storageOrigin(process.env.S3_ENDPOINT);

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://s3.tradingview.com${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' blob:" + (storage ? ` ${storage}` : ""),
    "connect-src 'self'" + (storage ? ` ${storage}` : "") + (isDev ? " ws: wss:" : ""),
    "worker-src 'self' blob:",
    "frame-src https://s.tradingview.com https://www.tradingview-widget.com https://www.tradingview.com https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://iframe.mediadelivery.net https://player.mediadelivery.net",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isHttps ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Lets layouts gate whole sections before streaming starts (real 404 status codes).
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: API routes, static assets and the pdf.js worker are excluded
      // (route handlers stream large uploads and must not be buffered by the proxy).
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|robots.txt|sitemap.xml|manifest.webmanifest|pdfjs|images).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

function storageOrigin(endpoint: string | undefined) {
  if (!endpoint) return null;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1" ? url.origin : null;
  } catch {
    return null;
  }
}
