"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { MAIN_NAV } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  return (
    <nav aria-label="Asosiy navigatsiya" className="hidden lg:block">
      <ul className="flex items-center gap-0.5 rounded-2xl border border-border/80 bg-surface/60 p-1">
        {MAIN_NAV.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href} className="relative">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative z-10 block rounded-xl px-2.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors xl:px-3.5",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
              {active &&
                (reduce ? (
                  <span aria-hidden className="absolute inset-0 rounded-xl border border-primary/25 bg-card-elevated" />
                ) : (
                  <motion.span
                    layoutId="nav-active-pill"
                    aria-hidden
                    className="absolute inset-0 rounded-xl border border-primary/25 bg-card-elevated shadow-[0_0_0_1px_rgb(0_0_0/0.2)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  >
                    <span className="absolute inset-x-3 -bottom-px h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
                  </motion.span>
                ))}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
