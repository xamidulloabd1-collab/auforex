import Link from "next/link";
import { ArrowRightIcon, BookOpenIcon, CrownIcon, InboxIcon, PlayCircleIcon, TrophyIcon, UsersIcon } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AUDIT_LABELS } from "@/lib/audit";
import { formatPrice } from "@/lib/pricing";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { AdminTitle } from "@/components/admin/admin-title";

export default async function SuperAdminOverviewPage() {
  const viewer = await requireSuperAdmin();
  const now = new Date();
  const [users, pro, lessons, books, challenges, pendingCount, pending, recent, newUsers] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({ where: { status: "PRO_ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
    prisma.lesson.count({ where: { isPublished: true } }),
    prisma.book.count({ where: { isPublished: true } }),
    prisma.challenge.count({ where: { status: "PUBLISHED", endsAt: { gte: now } } }),
    prisma.proRequest.count({ where: { status: "PENDING" } }),
    prisma.proRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, price: true, currency: true, createdAt: true, user: { select: { name: true, email: true } } },
    }),
    prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, action: true, summary: true, createdAt: true } }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, name: true, email: true, createdAt: true } }),
  ]);

  return (
    <>
      <AdminTitle title={`Xush kelibsiz, ${viewer.name.split(" ")[0]}`} description="Super admin paneli — platformaning to‘liq boshqaruvi. Ko‘rsatkichlar ma’lumotlar bazasidan olinadi." />

      <section
        aria-labelledby="pending-requests"
        className={`mb-6 rounded-2xl border p-4 sm:p-5 ${pendingCount > 0 ? "border-primary/40 bg-primary/[0.06]" : "border-border bg-card"}`}
        data-testid="pending-requests-card"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-gold-soft">
              <InboxIcon className="size-5" />
            </span>
            <div>
              <h2 id="pending-requests" className="font-display text-base font-bold">
                Yangi PRO arizalari: <span className="font-mono">{pendingCount}</span>
              </h2>
              <p className="text-sm text-muted-foreground">{pendingCount > 0 ? "To‘lovni Telegram’da tekshiring va PRO’ni oching." : "Hozircha kutilayotgan ariza yo‘q."}</p>
            </div>
          </div>
          <Link href="/super-admin/requests" className={buttonVariants({ variant: pendingCount > 0 ? "default" : "secondary", className: "w-full sm:w-auto" })}>
            Arizalarni ko‘rish <ArrowRightIcon />
          </Link>
        </div>
        {pending.length > 0 && (
          <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {pending.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.user.email}</span>
                </span>
                <span className="hidden font-mono text-xs sm:inline">
                  {formatPrice(r.price)} {r.currency}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">{formatDateTime(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5" data-testid="admin-stats">
        <StatCard label="Ro‘yxatdan o‘tganlar" value={users} icon={<UsersIcon />} />
        <StatCard label="Faol PRO" value={pro} icon={<CrownIcon />} />
        <StatCard label="Darslar" value={lessons} icon={<PlayCircleIcon />} />
        <StatCard label="Kitoblar" value={books} icon={<BookOpenIcon />} />
        <StatCard label="Faol challenge’lar" value={challenges} icon={<TrophyIcon />} className="col-span-2 xl:col-span-1" />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 xl:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="activity" className="min-w-0">
          <div className="flex items-center justify-between">
            <h2 id="activity" className="font-display text-lg font-bold">
              So‘nggi faoliyat
            </h2>
            <Link href="/super-admin/audit" className="inline-flex min-h-11 items-center text-sm text-gold-soft hover:underline">
              Audit jurnali
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Hali qayd etilgan amallar yo‘q.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {recent.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm sm:px-5">
                  <Badge variant="secondary">{AUDIT_LABELS[r.action] ?? r.action}</Badge>
                  <span className="min-w-0 flex-1 basis-full truncate text-muted-foreground sm:basis-auto">{r.summary}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="new-users" className="min-w-0">
          <div className="flex items-center justify-between">
            <h2 id="new-users" className="font-display text-lg font-bold">
              Yangi foydalanuvchilar
            </h2>
            <Link href="/super-admin/users" className="inline-flex min-h-11 items-center text-sm text-gold-soft hover:underline">
              Barchasi
            </Link>
          </div>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {newUsers.map((u) => (
              <li key={u.id}>
                <Link href={`/super-admin/users/${u.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-secondary/40 sm:px-5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{u.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">{formatDateTime(u.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
