import type { Metadata } from "next";
import Link from "next/link";
import { getViewer } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { AuthHeading, FormAlert } from "@/components/auth/auth-card";

export const metadata: Metadata = { title: "Email tasdiqlash", robots: { index: false } };

/** Landing page for email verification links (Better Auth appends ?error on failure). */
export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const { error } = await searchParams;
  const viewer = await getViewer();
  return (
    <>
      <AuthHeading eyebrow="Email tasdiqlash" title={error ? "Havola yaroqsiz" : "Email tasdiqlandi"} />
      {error ? (
        <FormAlert>Tasdiqlash havolasi yaroqsiz yoki muddati tugagan. Kirish sahifasida yoki profil sozlamalarida yangi xat so‘rashingiz mumkin.</FormAlert>
      ) : (
        <FormAlert tone="success">Email manzilingiz tasdiqlandi. Xush kelibsiz!</FormAlert>
      )}
      <Button asChild className="mt-6 w-full" size="lg">
        <Link href={viewer ? "/dashboard" : "/login"}>{viewer ? "Shaxsiy kabinetga o‘tish" : "Kirish"}</Link>
      </Button>
    </>
  );
}
