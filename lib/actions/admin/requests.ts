"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db/prisma";
import { grantProAccess } from "@/lib/subscription/grant";
import { actionError, UserFacingError, type ActionResult } from "../result";

const approveSchema = z.object({
  /** 0 = until revoked */
  durationDays: z.coerce.number().int().min(0).max(3650),
  note: z.string().trim().max(500),
});

function revalidate() {
  revalidatePath("/super-admin", "layout");
}

/** "To‘lov qabul qilindi" — activates PRO for the request's user right away. */
export async function approveProRequest(requestId: string, input: z.input<typeof approveSchema>): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const data = approveSchema.parse(input);
    const request = await prisma.proRequest.findUnique({ where: { id: z.string().min(1).max(40).parse(requestId) }, select: { userId: true, status: true } });
    if (!request) throw new UserFacingError("Ariza topilmadi");
    if (request.status !== "PENDING") throw new UserFacingError("Bu ariza allaqachon ko‘rib chiqilgan");

    // Extend from the current expiry if PRO is still active, otherwise from now.
    let expiresAt: Date | null = null;
    if (data.durationDays > 0) {
      const sub = await prisma.subscription.findUnique({ where: { userId: request.userId }, select: { status: true, expiresAt: true } });
      const base = sub?.status === "PRO_ACTIVE" && sub.expiresAt && sub.expiresAt > new Date() ? sub.expiresAt : new Date();
      expiresAt = new Date(base.getTime() + data.durationDays * 24 * 60 * 60 * 1000);
    }
    await grantProAccess({ actorId: admin.id, userId: request.userId, expiresAt, note: data.note || "Telegram orqali to‘lov", requestId });
    revalidate();
    return { ok: true, message: "To‘lov tasdiqlandi — PRO ochildi" };
  } catch (err) {
    return actionError(err);
  }
}

export async function rejectProRequest(requestId: string, note: string): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const request = await prisma.proRequest.findUnique({
      where: { id: z.string().min(1).max(40).parse(requestId) },
      select: { status: true, user: { select: { email: true } } },
    });
    if (!request) throw new UserFacingError("Ariza topilmadi");
    if (request.status !== "PENDING") throw new UserFacingError("Bu ariza allaqachon ko‘rib chiqilgan");
    const cleanNote = z.string().trim().max(500).parse(note);
    await prisma.proRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED", handledById: admin.id, handledAt: new Date(), note: cleanNote || null },
    });
    await audit({ actorId: admin.id, action: "pro_request.reject", targetType: "ProRequest", targetId: requestId, summary: `${request.user.email}: ariza rad etildi` });
    revalidate();
    return { ok: true, message: "Ariza rad etildi" };
  } catch (err) {
    return actionError(err);
  }
}
