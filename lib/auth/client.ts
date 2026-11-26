"use client";

import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

/** Browser auth client (same-origin; cookies are httpOnly and never readable from JS). */
export const authClient = createAuthClient({ plugins: [usernameClient()] });

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email yoki parol noto‘g‘ri",
  INVALID_USERNAME_OR_PASSWORD: "Login yoki parol noto‘g‘ri",
  USER_ALREADY_EXISTS: "Bu email bilan hisob allaqachon mavjud",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Bu email bilan hisob allaqachon mavjud",
  EMAIL_NOT_VERIFIED: "Email manzilingiz hali tasdiqlanmagan",
  INVALID_TOKEN: "Havola yaroqsiz yoki muddati tugagan",
  TOKEN_EXPIRED: "Havola muddati tugagan. Yangisini so‘rang",
  PASSWORD_TOO_SHORT: "Parol juda qisqa",
  PASSWORD_TOO_LONG: "Parol juda uzun",
  INVALID_PASSWORD: "Joriy parol noto‘g‘ri",
  ACCOUNT_SUSPENDED: "Hisobingiz vaqtincha bloklangan. Administrator bilan bog‘laning.",
  INVALID_ORIGIN: "Xavfsizlik tekshiruvi o‘tmadi. Sahifani yangilab, qayta urinib ko‘ring.",
  MISSING_OR_NULL_ORIGIN: "Xavfsizlik tekshiruvi o‘tmadi. Sahifani yangilab, qayta urinib ko‘ring.",
  SERVER_MISCONFIGURED: "Sayt sozlamalarida xatolik bor. Administrator xabardor qilindi.",
  MAIL_NOT_CONFIGURED: "Pochta xizmati sozlanmagan. Administrator bilan bog‘laning.",
  MAIL_SEND_FAILED: "Pochta xizmati vaqtincha ishlamayapti. Birozdan so‘ng qayta urinib ko‘ring.",
  SERVER_ERROR: "Serverda vaqtinchalik xatolik. Birozdan so‘ng qayta urinib ko‘ring.",
  DATABASE_UNAVAILABLE: "Ma’lumotlar bazasiga ulanib bo‘lmadi. Birozdan so‘ng qayta urinib ko‘ring.",
  USERNAME_IS_ALREADY_TAKEN: "Bu login band",
  USERNAME_IS_ALREADY_TAKEN_PLEASE_TRY_ANOTHER: "Bu login band",
  INVALID_EMAIL: "Email manzil noto‘g‘ri",
  FAILED_TO_CREATE_USER: "Hisob yaratilmadi. Qayta urinib ko‘ring.",
};

/** Maps Better Auth error payloads to Uzbek UI messages. */
export function authErrorMessage(error: { code?: string; message?: string; status?: number } | null | undefined) {
  if (!error) return "Kutilmagan xatolik yuz berdi";
  if (error.status === 429) return "Juda ko‘p urinish. Bir necha daqiqadan so‘ng qayta urinib ko‘ring.";
  if (error.code && ERROR_MESSAGES[error.code]) return ERROR_MESSAGES[error.code]!;
  // Server-side validation messages are already in Uzbek.
  if (error.message && /[‘’]|kiriting|parol|ism|hisob/i.test(error.message)) return error.message;
  if (!error.status) return "Server bilan aloqa yo‘q. Internetni tekshirib, qayta urinib ko‘ring.";
  if (error.status >= 500) return "Serverda vaqtinchalik xatolik. Birozdan so‘ng qayta urinib ko‘ring.";
  return "Amalni bajarib bo‘lmadi. Qayta urinib ko‘ring.";
}
