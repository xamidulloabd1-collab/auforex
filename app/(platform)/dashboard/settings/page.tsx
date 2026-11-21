import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isMailConfigured } from "@/lib/env";
import { DashTitle } from "@/components/dashboard/stat-card";
import { AccountActions, AvatarForm, ChangeEmailForm, ChangePasswordForm, ProfileForm, SettingsCard } from "@/components/dashboard/settings-forms";

export const metadata: Metadata = { title: "Profil sozlamalari", robots: { index: false } };

export default async function SettingsPage() {
  const viewer = await requireUser("/dashboard/settings");
  const profile = await prisma.profile.findUnique({ where: { userId: viewer.id } });

  return (
    <>
      <DashTitle title="Profil sozlamalari" description="Shaxsiy ma’lumotlar, avatar, parol va hisob sozlamalari." />
      <div className="grid gap-6">
        <SettingsCard title="Avatar">
          <AvatarForm name={viewer.name} image={viewer.image} />
        </SettingsCard>
        <SettingsCard title="Shaxsiy ma’lumotlar">
          <ProfileForm
            defaults={{
              name: viewer.name,
              bio: profile?.bio ?? "",
              telegram: profile?.telegram ? `@${profile.telegram}` : "",
              experienceLevel: profile?.experienceLevel ?? "",
            }}
          />
        </SettingsCard>
        <SettingsCard title="Parolni o‘zgartirish" description="Kamida 8 ta belgi, harf va raqam bo‘lsin.">
          <ChangePasswordForm />
        </SettingsCard>
        <SettingsCard title="Hisob sozlamalari">
          <AccountActions email={viewer.email} username={viewer.username} emailVerified={viewer.emailVerified} canResend={isMailConfigured()} />
        </SettingsCard>
        <SettingsCard title="Emailni o‘zgartirish" description="Parolni tiklash xatlari shu manzilga keladi. Xavfsizlik uchun joriy parol so‘raladi.">
          <ChangeEmailForm />
        </SettingsCard>
      </div>
    </>
  );
}
