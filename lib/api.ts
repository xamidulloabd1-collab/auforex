import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthorizationError } from "@/lib/auth/session";
import { UploadError } from "@/lib/storage";
import { RateLimitError } from "@/lib/rate-limit";

export function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Maps known errors to safe JSON responses; unknown errors are logged, never leaked. */
export function handleRouteError(err: unknown) {
  if (err instanceof AuthorizationError) return jsonError(err.status, err.message);
  if (err instanceof UploadError) return jsonError(err.status, err.message);
  if (err instanceof RateLimitError) {
    return NextResponse.json(
      { error: err.message },
      { status: 429, headers: { "Retry-After": String(err.retryAfterSeconds), "Cache-Control": "no-store" } },
    );
  }
  if (err instanceof ZodError) {
    return jsonError(400, err.issues[0]?.message ?? "Ma’lumotlar noto‘g‘ri");
  }
  console.error("[api] unexpected error", err);
  return jsonError(500, "Kutilmagan xatolik yuz berdi. Keyinroq qayta urinib ko‘ring.");
}

/**
 * Same-origin check for state-changing route handlers (defence in depth on top of
 * SameSite=Lax session cookies). Server Actions get this check from Next.js itself.
 */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) throw new AuthorizationError(403, "So‘rov manbasi tasdiqlanmadi");
  try {
    if (new URL(origin).host !== host) throw new Error("mismatch");
  } catch {
    throw new AuthorizationError(403, "So‘rov manbasi tasdiqlanmadi");
  }
}

export function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
