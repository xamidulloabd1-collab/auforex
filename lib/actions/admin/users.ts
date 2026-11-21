"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin, assertSuperAdmin, type Viewer } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db/prisma";
import { fromDateTimeLocalValue } from "@/lib/utils";
import { grantProAccess } from "@/lib/subscription/grant";
import { grantProSchema } from "@/lib/validations/admin";
import { actionError, UserFacingError, type ActionResult } from "../result";

const idSchema = z.string().min(1).max(40);

/** Ensures the target exists and is not the acting super admin. */
async function assertCanManage(actor: Viewer, targetId: string) {
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true } });
  if (!target) throw new UserFacingError("Foydalanuvchi topilmadi");
  if (targetId === actor.id) throw new UserFacingError("Bu amalni o‘z hisobingizga qo‘llab bo‘lmaydi");
  return target;
}

async function activeSuperAdmins() {
  return prisma.user.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE" } });
}

function parseExpiry(value: string) {
  if (!value) return null;
  const d = fromDateTimeLocalValue(value.includes("T") ? value : `${value}T23:59`);
  if (!d || Number.isNaN(d.getTime())) throw new UserFacingError("Sana noto‘g‘ri");
  if (d.getTime() <= Date.now()) throw new UserFacingError("Tugash sanasi kelajakda bo‘lishi kerak");
  return d;
}

/** Grants (or extends) PRO manually from the user page. Pending PRO requests are closed as approved. */
export async function grantPro(userId: string, input: { expiresAt: string; note: string }): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    idSchema.parse(userId);
    const data = grantProSchema.parse(input);
    const expiresAt = parseExpiry(data.expiresAt);
    await grantProAccess({ actorId: admin.id, userId, expiresAt, note: data.note || null });
    revalidatePath(`/super-admin/users/${userId}`);
    revalidatePath("/super-admin/users");
    revalidatePath("/super-admin/requests");
    return { ok: true, message: "PRO berildi" };
  } catch (err) {
    if (err instanceof Error && err.message === "USER_NOT_FOUND") return { ok: false, error: "Foydalanuvchi topilmadi" };
    return actionError(err);
  }
}

export async function revokePro(userId: string): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    idSchema.parse(userId);
    const sub = await prisma.subscription.findUnique({ where: { userId }, select: { status: true, user: { select: { email: true } } } });
    if (!sub) throw new UserFacingError("Obuna topilmadi");
    await prisma.subscription.update({ where: { userId }, data: { status: "PRO_CANCELLED", cancelledAt: new Date() } });
    await audit({ actorId: admin.id, action: "subscription.revoke", targetType: "User", targetId: userId, summary: `${sub.user.email}: PRO bekor qilindi` });
    revalidatePath(`/super-admin/users/${userId}`);
    revalidatePath("/super-admin/users");
    return { ok: true, message: "PRO bekor qilindi" };
  } catch (err) {
    return actionError(err);
  }
}

export async function setSubscriptionExpiry(userId: string, expiresAtValue: string): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    idSchema.parse(userId);
    const expiresAt = parseExpiry(expiresAtValue);
    const sub = await prisma.subscription.findUnique({ where: { userId }, select: { status: true, user: { select: { email: true } } } });
    if (!sub || sub.status !== "PRO_ACTIVE") throw new UserFacingError("Faqat faol PRO obuna uchun muddat belgilanadi");
    await prisma.subscription.update({ where: { userId }, data: { expiresAt } });
    await audit({
      actorId: admin.id,
      action: "subscription.update",
      targetType: "User",
      targetId: userId,
      summary: `${sub.user.email}: muddat ${expiresAt ? expiresAt.toISOString().slice(0, 10) : "olib tashlandi"}`,
    });
    revalidatePath(`/super-admin/users/${userId}`);
    return { ok: true, message: "Muddat yangilandi" };
  } catch (err) {
    return actionError(err);
  }
}

export async function setAccountStatus(userId: string, status: "ACTIVE" | "SUSPENDED"): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    idSchema.parse(userId);
    z.enum(["ACTIVE", "SUSPENDED"]).parse(status);
    if (userId === admin.id) throw new UserFacingError("O‘z hisobingiz holatini o‘zgartira olmaysiz");
    const target = await assertCanManage(admin, userId);
    if (status === "SUSPENDED" && target.role === "SUPER_ADMIN" && (await activeSuperAdmins()) <= 1) {
      throw new UserFacingError("Yagona super adminni bloklab bo‘lmaydi");
    }
    const user = await prisma.user.update({ where: { id: userId }, data: { status }, select: { email: true } });
    if (status === "SUSPENDED") await prisma.session.deleteMany({ where: { userId } });
    await audit({ actorId: admin.id, action: "user.status", targetType: "User", targetId: userId, summary: `${user.email}: ${status}` });
    revalidatePath(`/super-admin/users/${userId}`);
    revalidatePath("/super-admin/users");
    return { ok: true, message: status === "SUSPENDED" ? "Hisob bloklandi" : "Hisob faollashtirildi" };
  } catch (err) {
    return actionError(err);
  }
}

export async function setUserRole(userId: string, role: "USER" | "SUPER_ADMIN"): Promise<ActionResult> {
  try {
    const actor = await assertSuperAdmin();
    idSchema.parse(userId);
    z.enum(["USER", "SUPER_ADMIN"]).parse(role);
    if (userId === actor.id) throw new UserFacingError("O‘z rolingizni o‘zgartira olmaysiz");
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!target) throw new UserFacingError("Foydalanuvchi topilmadi");
    if (target.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN" && (await activeSuperAdmins()) <= 1) {
      throw new UserFacingError("Kamida bitta super admin qolishi kerak");
    }
    const user = await prisma.user.update({ where: { id: userId }, data: { role }, select: { email: true } });
    // Role changes take effect on the next request; sessions stay valid.
    await audit({ actorId: actor.id, action: "user.role", targetType: "User", targetId: userId, summary: `${user.email}: ${target.role} → ${role}` });
    revalidatePath(`/super-admin/users/${userId}`);
    revalidatePath("/super-admin/team");
    return { ok: true, message: "Rol yangilandi" };
  } catch (err) {
    return actionError(err);
  }
}

/** Find a registered user by email or login and make them a super admin. */
export async function addAdminByIdentifier(identifier: string): Promise<ActionResult> {
  try {
    const actor = await assertSuperAdmin();
    const value = z.string().trim().min(3).max(254).parse(identifier).toLowerCase();
    const user = await prisma.user.findFirst({
      where: value.includes("@") ? { email: value } : { username: value },
      select: { id: true, email: true, role: true, status: true },
    });
    if (!user) throw new UserFacingError("Bunday foydalanuvchi topilmadi. Avval u ro‘yxatdan o‘tishi kerak.");
    if (user.role !== "USER") throw new UserFacingError("Bu foydalanuvchi allaqachon super admin");
    if (user.status !== "ACTIVE") throw new UserFacingError("Bloklangan hisobni super admin qilib bo‘lmaydi");
    await prisma.user.update({ where: { id: user.id }, data: { role: "SUPER_ADMIN" } });
    await audit({ actorId: actor.id, action: "user.role", targetType: "User", targetId: user.id, summary: `${user.email}: USER → SUPER_ADMIN` });
    revalidatePath("/super-admin/team");
    return { ok: true, message: "Super admin qo‘shildi" };
  } catch (err) {
    return actionError(err);
  }
}

export async function revokeUserSessions(userId: string): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    idSchema.parse(userId);
    if (userId !== admin.id) await assertCanManage(admin, userId);
    const res = await prisma.session.deleteMany({ where: { userId } });
    await audit({ actorId: admin.id, action: "user.sessions.revoke", targetType: "User", targetId: userId, summary: `${res.count} ta sessiya yopildi` });
    revalidatePath(`/super-admin/users/${userId}`);
    return { ok: true, message: `${res.count} ta sessiya yopildi` };
  } catch (err) {
    return actionError(err);
  }
}
