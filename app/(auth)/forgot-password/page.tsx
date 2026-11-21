import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Parolni tiklash", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading eyebrow="Parolni tiklash" title="Parolni unutdingizmi?" description="Hisobingizga bog‘langan emailni kiriting — tiklash havolasini yuboramiz." />
      <ForgotPasswordForm />
    </>
  );
}
