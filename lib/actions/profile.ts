"use server";

import { revalidatePath } from "next/cache";
import { verifyPassword } from "better-auth/crypto";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { assertUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isMailConfigured } from "@/lib/env";
import { rateLimit, RateLimitError } from "@/lib/rate-limit";
import { emailSchema } from "@/lib/validations/auth";
import { profileSchema, type ProfileInput } from "@/lib/validations/profile";
import { actionError, UserFacingError, type ActionResult } from "./result";

export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  try {
    const viewer = await assertUser();
    const data = profileSchema.parse(input);
    const telegram = data.telegram ? data.telegram.replace(/^@/, "") : null;
    await prisma.$transaction([
      prisma.user.update({ where: { id: viewer.id }, data: { name: data.name } }),
      prisma.profile.upsert({
        where: { userId: viewer.id },
        update: { bio: data.bio || null, telegram, experienceLevel: data.experienceLevel || null },
        create: { userId: viewer.id, bio: data.bio || null, telegram, experienceLevel: data.experienceLevel || null },
      }),
    ]);
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Profil saqlandi" };
  } catch (err) {
    return actionError(err);
  }
}

export async function removeAvatar(): Promise<ActionResult> {
  try {
    const viewer = await assertUser();
    await prisma.user.update({ where: { id: viewer.id }, data: { image: null } });
    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (err) {
    return actionError(err);
  }
}

const changeEmailSchema = z.object({
  newEmail: emailSchema,
  currentPassword: z.string().min(1, "Joriy parolni kiriting").max(128),
});

/**
 * Changes the sign-in email after re-checking the current password.
 * The new address starts unverified; a verification email is sent when SMTP is configured.
 */
export async function changeEmail(input: z.input<typeof changeEmailSchema>): Promise<ActionResult> {
  try {
    const viewer = await assertUser();
    rateLimit(`change-email:${viewer.id}`, 5, 10 * 60_000);
    const { newEmail, currentPassword } = changeEmailSchema.parse(input);
    if (!isMailConfigured()) throw new UserFacingError("Pochta xizmati sozlanmagan. Emailni o‘zgartirib bo‘lmaydi.");
    if (newEmail === viewer.email) throw new UserFacingError("Bu sizning joriy emailingiz");
    const account = await prisma.account.findFirst({ where: { userId: viewer.id, providerId: "credential" }, select: { password: true } });
    if (!account?.password || !(await verifyPassword({ hash: account.password, password: currentPassword }))) {
      throw new UserFacingError("Joriy parol noto‘g‘ri");
    }
    if (await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } })) {
      throw new UserFacingError("Bu email boshqa hisobda ishlatilmoqda");
    }
    await prisma.user.update({ where: { id: viewer.id }, data: { email: newEmail, emailVerified: false } });
    try {
      await getAuth().api.sendVerificationEmail({ body: { email: newEmail, callbackURL: "/verify-email" } });
    } catch (error) {
      await prisma.user.update({ where: { id: viewer.id }, data: { email: viewer.email, emailVerified: viewer.emailVerified } });
      throw error;
    }
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Email o‘zgartirildi. Yangi manzilga tasdiqlash xati yuborildi." };
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    return actionError(err);
  }
}
