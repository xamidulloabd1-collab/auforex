import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AuthHeading, FormAlert } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { isMailConfigured } from "@/lib/env";
import { getSetting } from "@/lib/settings";

export const metadata: Metadata = { title: "Parolni tiklash", robots: { index: false } };

export default async function ForgotPasswordPage() {
  // Read the mail settings at request time (they can change with the deployment's variables).
  await connection();

  if (!isMailConfigured()) {
    // No mail service yet: say so up front instead of a form that can only fail.
    const academy = await getSetting("academy").catch(() => null);
    return (
      <>
        <AuthHeading eyebrow="Parolni tiklash" title="Parolni unutdingizmi?" description="Tiklash havolasini hozircha emailga yubora olmaymiz." />
        <div className="grid gap-5" data-testid="password-reset-unavailable">
          <FormAlert tone="info">
            Email orqali parolni tiklash vaqtincha mavjud emas — bu imkoniyat tez orada ishga tushiriladi. Parolingizni eslay
            olmasangiz, administratorga yozing.
            {academy?.telegramUrl && (
              <a href={academy.telegramUrl} target="_blank" rel="noopener noreferrer" className="mt-3 block font-semibold text-gold-soft underline-offset-4 hover:underline">
                Telegram orqali yozish
              </a>
            )}
          </FormAlert>
          <Link href="/login" className="text-center text-sm text-muted-foreground transition hover:text-foreground">
            Kirish sahifasiga qaytish
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthHeading eyebrow="Parolni tiklash" title="Parolni unutdingizmi?" description="Hisobingizga bog‘langan emailni kiriting — tiklash havolasini yuboramiz." />
      <ForgotPasswordForm />
    </>
  );
}
