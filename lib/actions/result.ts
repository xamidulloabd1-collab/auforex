import { ZodError } from "zod";
import { AuthorizationError } from "@/lib/auth/session";

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

/** Converts thrown errors into a safe, user-facing action result. */
export function actionError(err: unknown): { ok: false; error: string } {
  if (err instanceof AuthorizationError) return { ok: false, error: err.message };
  if (err instanceof ZodError) return { ok: false, error: err.issues[0]?.message ?? "Ma’lumotlar noto‘g‘ri" };
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
