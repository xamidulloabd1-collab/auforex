import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/db/generated/client";

export type AuditEntry = {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  summary?: string;
  metadata?: Prisma.InputJsonValue;
};

/** Records a sensitive admin action. Failures are logged but never block the action. */
export async function audit(entry: AuditEntry) {
  let ip: string | null = null;
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
  } catch {
    // headers() unavailable outside a request scope
  }
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        summary: entry.summary?.slice(0, 500),
        metadata: entry.metadata,
        ipAddress: ip,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write audit log", err);
  }
}

export const AUDIT_LABELS: Record<string, string> = {
  "subscription.grant": "PRO berildi",
  "subscription.revoke": "PRO bekor qilindi",
  "subscription.update": "Obuna yangilandi",
  "user.status": "Hisob holati o‘zgardi",
  "user.role": "Rol o‘zgardi",
  "user.sessions.revoke": "Sessiyalar bekor qilindi",
  "course.create": "Kurs yaratildi",
  "course.update": "Kurs yangilandi",
  "course.delete": "Kurs o‘chirildi",
  "category.create": "Kategoriya yaratildi",
  "category.update": "Kategoriya yangilandi",
  "category.delete": "Kategoriya o‘chirildi",
  "lesson.create": "Dars yaratildi",
  "lesson.update": "Dars yangilandi",
  "lesson.delete": "Dars o‘chirildi",
  "lesson.publish": "Dars nashr holati o‘zgardi",
  "book.create": "Kitob qo‘shildi",
  "book.update": "Kitob yangilandi",
  "book.delete": "Kitob o‘chirildi",
  "book.publish": "Kitob nashr holati o‘zgardi",
  "challenge.create": "Challenge yaratildi",
  "challenge.update": "Challenge yangilandi",
  "challenge.delete": "Challenge o‘chirildi",
  "challenge.status": "Challenge holati o‘zgardi",
  "challenge.results.publish": "Natijalar e’lon qilindi",
  "submission.review": "Topshiriq baholandi",
  "reward.create": "Mukofot qo‘shildi",
  "reward.update": "Mukofot yangilandi",
  "reward.delete": "Mukofot o‘chirildi",
  "settings.update": "Sayt sozlamalari yangilandi",
  "founder.update": "Founder ma’lumotlari yangilandi",
  "upload.create": "Fayl yuklandi",
  "pro_request.reject": "PRO arizasi rad etildi",
};
