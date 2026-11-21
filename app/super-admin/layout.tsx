import type { Metadata } from "next";
import Link from "next/link";
import { CrownIcon, ExternalLinkIcon } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ADMIN_NAV } from "@/lib/constants";
import { Logo } from "@/components/shared/logo";
import { SideNav } from "@/components/dashboard/side-nav";
import { UserMenu } from "@/components/layout/user-menu";

export const metadata: Metadata = { title: { default: "Super admin panel", template: "%s · Super admin · AU Forex Academy" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const pendingRequests = await prisma.proRequest.count({ where: { status: "PENDING" } });
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
          <Logo href="/super-admin" />
          <span
            className="hidden items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.18em] text-gold-soft uppercase sm:inline-flex"
            data-testid="admin-role-badge"
          >
            <CrownIcon className="size-3.5" /> Super admin
          </span>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/" className="hidden items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground sm:inline-flex">
              Saytga o‘tish <ExternalLinkIcon className="size-3.5" />
            </Link>
            <UserMenu user={{ name: admin.name, email: admin.email, image: admin.image, isAdmin: true, isSuperAdmin: admin.isSuperAdmin, hasPremium: true, isPro: false }} />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr] lg:gap-10 lg:py-10">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <SideNav
            items={ADMIN_NAV.map((i) => (i.href === "/super-admin/requests" ? { ...i, badge: pendingRequests } : i))}
            label="Super admin bo‘limlari"
            root="/super-admin"
          />
        </aside>
        <main id="main" className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
