import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/session";
import { AuthHeading } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Ro‘yxatdan o‘tish", robots: { index: false } };

export default async function RegisterPage() {
  if (await getViewer()) redirect("/dashboard");
  return (
    <>
      <AuthHeading eyebrow="Yangi hisob" title="O‘rganishni boshlang" description="Bepul hisob oching — PRO materiallar obuna orqali ochiladi." />
      <Suspense>
        <RegisterForm />
      </Suspense>
    </>
  );
}
