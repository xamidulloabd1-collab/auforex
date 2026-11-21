import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Yangi parol", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token, error } = await searchParams;
  return (
    <>
      <AuthHeading eyebrow="Parolni tiklash" title="Yangi parol o‘rnating" description="Parol o‘zgargach, boshqa qurilmalardagi sessiyalar yopiladi." />
      <ResetPasswordForm token={typeof token === "string" ? token : null} invalid={Boolean(error)} />
    </>
  );
}
