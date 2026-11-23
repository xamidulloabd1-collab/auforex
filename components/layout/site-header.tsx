import Link from "next/link";
import { getViewer } from "@/lib/auth/session";
import { withFallback } from "@/lib/data/safe";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { NavLinks } from "./nav-links";
import { MobileNav } from "./mobile-nav";
import { UserMenu, type HeaderUser } from "./user-menu";

export async function SiteHeader() {
  const viewer = await withFallback("viewer", getViewer, null);
  const user: HeaderUser | null = viewer
    ? {
        name: viewer.name,
        email: viewer.email,
        image: viewer.image,
        isAdmin: viewer.isAdmin,
        isSuperAdmin: viewer.isSuperAdmin,
        hasPremium: viewer.hasPremium,
        isPro: viewer.accessLevel === "PRO",
      }
    : null;

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/75 pt-[env(safe-area-inset-top)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Asosiy kontentga o‘tish
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-[72px] lg:px-8">
        <Logo />
        <NavLinks />
        <div className="flex items-center gap-2">
          {user ? (
            <div className="hidden lg:block">
              <UserMenu user={user} />
            </div>
          ) : (
            <div className="hidden items-center gap-2 lg:flex">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Kirish</Link>
              </Button>
              <Button asChild size="sm" className="hidden xl:inline-flex">
                <Link href="/register">Ro‘yxatdan o‘tish</Link>
              </Button>
            </div>
          )}
          {!user && (
            <Button asChild variant="ghost" size="sm" className="lg:hidden" data-testid="mobile-login">
              <Link href="/login">Kirish</Link>
            </Button>
          )}
          <MobileNav user={user} />
        </div>
      </div>
    </header>
  );
}
