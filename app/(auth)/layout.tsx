import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { AuthAside } from "@/components/auth/auth-aside";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <AuthAside />
      <div className="relative flex flex-col">
        <div className="flex items-center justify-between px-5 py-5 sm:px-8">
          <div className="lg:hidden">
            <Logo />
          </div>
          <Link href="/" className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
            <ArrowLeftIcon className="size-4" /> Bosh sahifa
          </Link>
        </div>
        <main id="main" className="flex flex-1 items-center justify-center px-5 pb-16 sm:px-8">
          <div className="w-full max-w-[420px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
