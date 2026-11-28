import type { Metadata } from "next";
import Link from "next/link";
import { getViewer } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { AuthHeading, FormAlert } from "@/components/auth/auth-card";

export const metadata: Metadata = { title: "Email tasdiqlash", robots: { index: false } };

/**
 * Landing page for email verification links. Better Auth verifies the token, signs the user in
 * and redirects here (with ?error=… when the link is invalid or expired). The page reports the
 * account's real state, so opening it directly never claims a verification that did not happen.
 */
export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const { error } = await searchParams;
  const viewer = await getViewer();
  const state = error ? "invalid" : viewer?.emailVerified ? "verified" : viewer ? "pending" : "unknown";

  const title = { invalid: "Havola yaroqsiz", verified: "Email tasdiqlandi", pending: "Email hali tasdiqlanmagan", unknown: "Email tasdiqlash" }[state];
  return (
    <>
      <AuthHeading eyebrow="Email tasdiqlash" title={title} />
      {state === "invalid" && (
        <FormAlert>Tasdiqlash havolasi yaroqsiz yoki muddati tugagan. Kirish sahifasida yoki profil sozlamalarida yangi xat so‘rashingiz mumkin.</FormAlert>
      )}
      {state === "verified" && <FormAlert tone="success">Email manzilingiz tasdiqlandi. Xush kelibsiz!</FormAlert>}
      {state === "pending" && (
        <FormAlert tone="info">
          {viewer!.email} manziliga yuborilgan xatdagi havolani oching. Xat kelmagan bo‘lsa, profil sozlamalarida qayta yuboring.
        </FormAlert>
      )}
      {state === "unknown" && <FormAlert tone="info">Emailingizga yuborilgan tasdiqlash havolasini oching yoki hisobingizga kiring.</FormAlert>}
      <Button asChild className="mt-6 w-full" size="lg">
        {state === "pending" ? (
          <Link href="/dashboard/settings">Profil sozlamalari</Link>
        ) : (
          <Link href={viewer ? "/dashboard" : "/login"}>{viewer ? "Shaxsiy kabinetga o‘tish" : "Kirish"}</Link>
        )}
      </Button>
    </>
  );
}
