"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenIcon,
  CrownIcon,
  InboxIcon,
  LayersIcon,
  LayoutDashboardIcon,
  PlayCircleIcon,
  SettingsIcon,
  TagsIcon,
  ShieldIcon,
  TrophyIcon,
  UserIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  layout: LayoutDashboardIcon,
  play: PlayCircleIcon,
  book: BookOpenIcon,
  trophy: TrophyIcon,
  crown: CrownIcon,
  settings: SettingsIcon,
  users: UsersIcon,
  layers: LayersIcon,
  user: UserIcon,
  shield: ShieldIcon,
  inbox: InboxIcon,
  tags: TagsIcon,
};

type Item = { href: string; label: string; icon: string; badge?: number };

function CountBadge({ value }: { value?: number }) {
  if (!value) return null;
  return (
    <span className="ml-auto min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center font-mono text-[11px] leading-none font-bold text-primary-foreground" aria-label={`${value} ta yangi`}>
      {value > 99 ? "99+" : value}
    </span>
  );
}

export function SideNav({ items, label, root }: { items: readonly Item[]; label: string; root: string }) {
  const pathname = usePathname();
  const scrollerRef = React.useRef<HTMLUListElement>(null);
  const isActive = (href: string) => (href === root ? pathname === root : pathname === href || pathname.startsWith(`${href}/`));

  // On phones the section list is a horizontal scroller: keep the active chip in view.
  React.useEffect(() => {
    const active = scrollerRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ block: "nearest", inline: "center", behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  return (
    <nav aria-label={label}>
      {/* Mobile: horizontal scroller */}
      <ul ref={scrollerRef} className="-mx-4 flex snap-x gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:hidden">
        {items.map((item) => {
          const Icon = ICONS[item.icon] ?? LayoutDashboardIcon;
          const active = isActive(item.href);
          return (
            <li key={item.href} className="shrink-0 snap-start">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm whitespace-nowrap transition-colors",
                  active ? "border-primary/40 bg-card-elevated text-foreground" : "border-border text-muted-foreground",
                )}
              >
                <Icon className="size-4" /> {item.label}
                <CountBadge value={item.badge} />
              </Link>
            </li>
          );
        })}
      </ul>
      {/* Desktop: vertical list */}
      <ul className="hidden gap-1 lg:grid">
        {items.map((item) => {
          const Icon = ICONS[item.icon] ?? LayoutDashboardIcon;
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-card-elevated text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {active && <span aria-hidden className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-primary" />}
                <Icon className={cn("size-4 transition-colors", active ? "text-gold-soft" : "group-hover:text-foreground")} />
                {item.label}
                <CountBadge value={item.badge} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
