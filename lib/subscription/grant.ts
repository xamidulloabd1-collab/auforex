import "server-only";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db/prisma";

/**
 * Activates (or extends) PRO for a user after a confirmed payment or a manual decision,
 * and closes the user's pending PRO requests as approved.
 */
export async function grantProAccess(input: { actorId: string; userId: string; expiresAt: Date | null; note: string | null; requestId?: string }) {
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true, subscription: true } });
  if (!user) throw new Error("USER_NOT_FOUND");
  const keepStart = user.subscription?.status === "PRO_ACTIVE" && user.subscription.startedAt;
  const now = new Date();

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { userId: input.userId },
      update: {
        status: "PRO_ACTIVE",
        source: "ADMIN",
        startedAt: keepStart ? undefined : now,
        expiresAt: input.expiresAt,
        cancelledAt: null,
        grantedById: input.actorId,
        note: input.note,
      },
      create: {
        userId: input.userId,
        status: "PRO_ACTIVE",
        source: "ADMIN",
        startedAt: now,
        expiresAt: input.expiresAt,
        grantedById: input.actorId,
        note: input.note,
      },
    }),
    prisma.proRequest.updateMany({
      where: { userId: input.userId, status: "PENDING" },
      data: { status: "APPROVED", handledById: input.actorId, handledAt: now, ...(input.note ? { note: input.note } : {}) },
    }),
  ]);

  await audit({
    actorId: input.actorId,
    action: "subscription.grant",
    targetType: "User",
    targetId: input.userId,
    summary: `${user.email}: PRO ${input.expiresAt ? `→ ${input.expiresAt.toISOString().slice(0, 10)}` : "(muddatsiz)"}${input.requestId ? " · ariza asosida" : ""}`,
    metadata: { expiresAt: input.expiresAt?.toISOString() ?? null, note: input.note, requestId: input.requestId ?? null },
  });
  return { email: user.email };
}
