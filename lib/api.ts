import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthorizationError } from "@/lib/auth/session";
import { UploadError } from "@/lib/storage";
import { S3Error } from "@/lib/storage/s3";
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
  // The browser closed the connection mid-request (upload cancelled, tab closed): not a server fault.
  if (err instanceof Error && (err as NodeJS.ErrnoException).code === "ECONNRESET" && err.message === "aborted") {
    console.warn("[api] request aborted by the client");
    return jsonError(400, "So‘rov to‘xtatildi.");
  }
  if (err instanceof S3Error) {
    console.error("[storage] S3 error", err.status, err.code, err.message);
    const hint =
      err.status === 403 || err.code === "SignatureDoesNotMatch" || err.code === "InvalidAccessKeyId"
        ? "S3 kalitlari noto‘g‘ri yoki ruxsat yetarli emas"
        : err.code === "NoSuchBucket"
          ? "S3_BUCKET nomi noto‘g‘ri"
          : err.code === "Timeout" || err.code === "NetworkError" || err.status >= 500
            ? "ombor vaqtincha javob bermadi — birozdan so‘ng qayta urinib ko‘ring"
            : `S3: ${err.code}`;
    return jsonError(502, `Fayl omboriga ulanishda xato (${hint}).`);
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
