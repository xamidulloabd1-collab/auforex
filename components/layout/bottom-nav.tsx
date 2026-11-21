"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenIcon, HomeIcon, LogInIcon, PlayCircleIcon, ShieldCheckIcon, TrophyIcon, UserRoundIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isActivePath } from "./nav-links";

type Props = { signedIn: boolean; isAdmin: boolean };

/** Routes that render their own full-screen controls on phones. */
function hiddenOn(pathname: string) {
  return /^\/books\/[^/]+/.test(pathname);
}

/**
 * Thumb-reach tab bar for phones and small tablets. Hidden from `lg` up, where the
 * header navigation is visible. Renders a spacer so the footer is never covered.
 */
export function BottomNav({ signedIn, isAdmin }: Props) {
  const pathname = usePathname();
  if (hiddenOn(pathname)) return null;

  const account = !signedIn
    ? { href: "/login", label: "Kirish", icon: LogInIcon, match: "/login" }
    : isAdmin
      ? { href: "/super-admin", label: "Panel", icon: ShieldCheckIcon, match: "/super-admin" }
      : { href: "/dashboard", label: "Kabinet", icon: UserRoundIcon, match: "/dashboard" };

  const items = [
    { href: "/", label: "Bosh sahifa", icon: HomeIcon, match: "/" },
    { href: "/lessons", label: "Darslar", icon: PlayCircleIcon, match: "/lessons" },
    { href: "/books", label: "Kitoblar", icon: BookOpenIcon, match: "/books" },
    { href: "/challenge", label: "Challenge", icon: TrophyIcon, match: "/challenge" },
    account,
  ];

  return (
    <>
      <div aria-hidden className="h-[calc(4rem+env(safe-area-inset-bottom))] lg:hidden" />
      <nav
        aria-label="Asosiy bo‘limlar"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/75 lg:hidden"
        data-testid="bottom-nav"
      >
        <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
          {items.map((item) => {
            const active = isActivePath(pathname, item.match);
            const Icon = item.icon;
            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-full flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors",
                    active ? "text-gold-soft" : "text-muted-foreground active:text-foreground",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-0 h-0.5 w-8 rounded-full bg-primary transition-opacity duration-300",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <Icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
