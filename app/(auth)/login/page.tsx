import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/utils";
import { AuthHeading } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Kirish", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const viewer = await getViewer();
  const { next } = await searchParams;
  if (viewer) redirect(safeRedirectPath(typeof next === "string" ? next : null));
  return (
    <>
      <AuthHeading eyebrow="Xush kelibsiz" title="Hisobingizga kiring" description="O‘qishni to‘xtagan joyingizdan davom ettiring." />
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
