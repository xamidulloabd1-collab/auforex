import { ZodError } from "zod";
import { AuthorizationError } from "@/lib/auth/session";
import { RateLimitError } from "@/lib/rate-limit";
import { UploadError } from "@/lib/storage";
import { S3Error } from "@/lib/storage/s3";

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

/** Converts thrown errors into a safe, user-facing action result. */
export function actionError(err: unknown): { ok: false; error: string } {
  if (err instanceof AuthorizationError) return { ok: false, error: err.message };
  if (err instanceof ZodError) return { ok: false, error: err.issues[0]?.message ?? "Ma’lumotlar noto‘g‘ri" };
  if (err instanceof RateLimitError || err instanceof UploadError) return { ok: false, error: err.message };
  if (err instanceof S3Error) {
    // The details (status, code) go to the log; the admin gets the likely cause.
    console.error("[action] storage error", err.status, err.code, err.message);
    const cause =
      err.status === 403 || err.code === "SignatureDoesNotMatch" || err.code === "InvalidAccessKeyId"
        ? "S3 kalitlari noto‘g‘ri yoki ruxsat yetarli emas"
        : err.code === "NoSuchBucket"
          ? "S3_BUCKET nomi noto‘g‘ri"
          : "ombor vaqtincha javob bermadi";
    return { ok: false, error: `Fayl omboriga ulanishda xato (${cause}). Keyinroq qayta urinib ko‘ring.` };
  }
  if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002") {
    return { ok: false, error: "Bunday qiymat allaqachon mavjud (masalan, slug takrorlangan)" };
  }
  if (err instanceof Error && err.name === "UserFacingError") return { ok: false, error: err.message };
  console.error("[action] unexpected error", err);
  return { ok: false, error: "Kutilmagan xatolik yuz berdi" };
}

export class UserFacingError extends Error {
  override name = "UserFacingError";
}
