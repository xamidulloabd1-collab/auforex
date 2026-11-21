"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimit, RateLimitError } from "@/lib/rate-limit";
import { getSetting } from "@/lib/settings";
import { actionError, type ActionResult } from "./result";

/**
 * Called when a signed-in user presses "PRO sotib olish" (the link itself opens the
 * founder's Telegram). Records one pending request per user; repeated clicks only
 * increase the attempt counter. PRO is NOT granted here — the super admin activates it
 * after confirming the payment.
 */
export async function createProRequest(): Promise<ActionResult<{ status: "created" | "pending" }>> {
  try {
    const viewer = await getViewer();
    if (!viewer) return { ok: false, error: "Ariza qoldirish uchun hisobingizga kiring" };
    rateLimit(`pro-request:${viewer.id}`, 20, 60 * 60_000);

    const settings = await getSetting("subscription");
    const pending = await prisma.proRequest.findFirst({ where: { userId: viewer.id, status: "PENDING" }, select: { id: true } });
    if (pending) {
      await prisma.proRequest.update({ where: { id: pending.id }, data: { attempts: { increment: 1 } } });
      return { ok: true, data: { status: "pending" } };
    }
    await prisma.proRequest.create({
      data: {
        userId: viewer.id,
        price: settings.price,
        oldPrice: settings.oldPrice,
        currency: settings.currency,
      },
    });
    revalidatePath("/super-admin", "layout");
    return { ok: true, data: { status: "created" } };
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    return actionError(err);
  }
}
