"use server";

import { assertSuperAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { appUrl } from "@/lib/env";
import { sendMail, verifyMailTransport, MailDeliveryError } from "@/lib/mail";
import { rateLimit } from "@/lib/rate-limit";
import { parseS3Config } from "@/lib/storage/config";
import { probeStorage, type ProbeStep } from "@/lib/storage/probe";
import { actionError, UserFacingError, type ActionResult } from "../result";

/**
 * Super admin → Sozlamalar → Tizim: live checks of the external services with the deployed
 * settings, so a wrong key or CORS rule is found before a real upload or sign-up fails.
 */
export async function checkStorageAction(): Promise<ActionResult<{ steps: ProbeStep[] }>> {
  try {
    const admin = await assertSuperAdmin();
    rateLimit(`system-check:${admin.id}`, 10, 60_000);
    const parsed = parseS3Config(process.env);
    if (!parsed.ok) throw new UserFacingError(parsed.error);
    if (!parsed.config) {
      throw new UserFacingError("Fayl ombori (R2) sozlanmagan — fayllar server diskida saqlanmoqda. Vercel’da S3_* sozlamalari shart.");
    }
    const steps = await probeStorage(parsed.config, new URL(appUrl()).origin);
    const failed = steps.filter((s) => !s.ok).length;
    await audit({ actorId: admin.id, action: "system.check", targetType: "Storage", targetId: parsed.config.bucket, summary: failed ? `${failed} ta xato` : "joyida" });
    return { ok: true, data: { steps }, message: failed ? `${failed} ta tekshiruv o‘tmadi` : "Fayl ombori to‘g‘ri sozlangan" };
  } catch (err) {
    return actionError(err);
  }
}

export async function sendTestEmailAction(): Promise<ActionResult> {
  try {
    const admin = await assertSuperAdmin();
    rateLimit(`system-mail:${admin.id}`, 3, 10 * 60_000);
    const connection = await verifyMailTransport();
    if (!connection.ok) throw new UserFacingError(connection.error);
    try {
      await sendMail({
        to: admin.email,
        subject: "AU Forex Academy: test xat",
        text: "Bu test xat. Pochta sozlamalari to‘g‘ri ishlayapti — ro‘yxatdan o‘tish va parol tiklash xatlari yetib boradi.",
        html: "<p>Bu test xat. Pochta sozlamalari to‘g‘ri ishlayapti — ro‘yxatdan o‘tish va parol tiklash xatlari yetib boradi.</p>",
      });
    } catch (err) {
      if (err instanceof MailDeliveryError) throw new UserFacingError(err.message);
      throw err;
    }
    await audit({ actorId: admin.id, action: "system.mail_test", targetType: "Mail", targetId: "smtp", summary: "Test xat yuborildi" });
    return { ok: true, message: `Test xat ${admin.email} manziliga yuborildi (Spam papkasini ham tekshiring)` };
  } catch (err) {
    return actionError(err);
  }
}
