"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CrownIcon, LogOutIcon, MenuIcon, ShieldCheckIcon } from "lucide-react";
import { MAIN_NAV } from "@/lib/constants";
import { cn, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LogoMark } from "@/components/shared/logo";
import { isActivePath } from "./nav-links";
import { useSignOut, type HeaderUser } from "./user-menu";

export function MobileNav({ user }: { user: HeaderUser | null }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const signOut = useSignOut();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="secondary" size="icon" className="lg:hidden" aria-label="Menyuni ochish" data-testid="mobile-menu-trigger">
          <MenuIcon className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="p-0" aria-describedby="mobile-nav-desc">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <LogoMark className="size-8" />
          <div>
            <SheetTitle className="text-sm tracking-wide">AU FOREX ACADEMY</SheetTitle>
            <SheetDescription id="mobile-nav-desc" className="text-xs">
              0 dan natijagacha — birga!
            </SheetDescription>
          </div>
        </div>

        <nav aria-label="Mobil navigatsiya" className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="grid gap-1">
            {MAIN_NAV.map((item, i) => {
              const active = isActivePath(pathname, item.href);
              return (
                <li
                  key={item.href}
                  className="animate-in fade-in-0 slide-in-from-right-4 fill-mode-both"
                  style={{ animationDelay: `${60 + i * 35}ms`, animationDuration: "320ms" }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center justify-between rounded-xl px-4 text-[15px] font-medium transition-colors",
                      active
                        ? "border border-primary/25 bg-card-elevated text-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    {item.label}
                    {active && <span className="size-1.5 rounded-full bg-primary" aria-hidden />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-border p-4">
          {user ? (
            <div className="grid gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  {user.image && <AvatarImage src={user.image} alt="" />}
                  <AvatarFallback>{initials(user.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                {user.isPro && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-gold-soft">
                    <CrownIcon className="size-3" /> PRO
                  </span>
                )}
              </div>
              {user.isAdmin && (
                <Button asChild variant="secondary" className="w-full" onClick={() => setOpen(false)}>
                  <Link href="/super-admin">
                    <ShieldCheckIcon /> Super admin panel
                  </Link>
                </Button>
              )}
              <Button variant="ghost" className="w-full" onClick={() => void signOut()}>
                <LogOutIcon /> Chiqish
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="secondary" onClick={() => setOpen(false)}>
                <Link href="/login">Kirish</Link>
              </Button>
              <Button asChild onClick={() => setOpen(false)}>
                <Link href="/register">Ro‘yxatdan o‘tish</Link>
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
