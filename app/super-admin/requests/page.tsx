import Link from "next/link";
import { InboxIcon } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getSetting } from "@/lib/settings";
import { formatPrice } from "@/lib/pricing";
import { effectiveStatus, SUBSCRIPTION_LABELS } from "@/lib/subscription/entitlement";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { TelegramIcon } from "@/components/shared/brand-icons";
import { AdminTitle } from "@/components/admin/admin-title";
import { ApproveRequestButton, RejectRequestButton } from "@/components/admin/request-actions";

const TABS = [
  { key: "PENDING", label: "Kutilmoqda" },
  { key: "APPROVED", label: "Tasdiqlangan" },
  { key: "REJECTED", label: "Rad etilgan" },
] as const;

export default async function ProRequestsPage({ searchParams }: PageProps<"/super-admin/requests">) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.status)?.key ?? "PENDING";
  const [counts, requests, pricing] = await Promise.all([
    prisma.proRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.proRequest.findMany({
      where: { status: tab },
      orderBy: tab === "PENDING" ? { createdAt: "asc" } : { handledAt: "desc" },
      take: 100,
      select: {
        id: true,
        price: true,
        currency: true,
        attempts: true,
        note: true,
        createdAt: true,
        handledAt: true,
        handledBy: { select: { name: true } },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            profile: { select: { telegram: true } },
            subscription: { select: { status: true, expiresAt: true } },
          },
        },
      },
    }),
    getSetting("subscription"),
  ]);
  const countOf = (k: string) => counts.find((c) => c.status === k)?._count._all ?? 0;

  return (
    <>
      <AdminTitle
        title="PRO arizalari"
        description="“PRO sotib olish” tugmasini bosgan foydalanuvchilar. Telegram’da to‘lovni qabul qilgach, “To‘lov qabul qilindi” tugmasini bosing — PRO o‘sha foydalanuvchiga darhol ochiladi."
      />

      <nav aria-label="Ariza holati" className="-mx-4 mb-6 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`?status=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm whitespace-nowrap",
              tab === t.key ? "border-primary/50 bg-primary/10 text-gold-soft" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] text-foreground">{countOf(t.key)}</span>
          </Link>
        ))}
      </nav>

      {requests.length === 0 ? (
        <EmptyState
          icon={<InboxIcon />}
          title={tab === "PENDING" ? "Yangi ariza yo‘q" : "Bu bo‘limda ariza yo‘q"}
          description={tab === "PENDING" ? "Foydalanuvchi “PRO sotib olish” tugmasini bosganda ariza shu yerda paydo bo‘ladi." : undefined}
        />
      ) : (
        <ul className="grid gap-3" data-testid="request-list">
          {requests.map((r) => {
            const st = effectiveStatus(r.user.subscription);
            const tg = r.user.profile?.telegram;
            return (
              <li key={r.id} className="card-surface p-4 sm:p-5" data-testid="request-item">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <Link href={`/super-admin/users/${r.user.id}`} className="font-display text-base font-bold hover:text-gold-soft">
                      {r.user.name}
                    </Link>
                    <p className="truncate text-sm text-muted-foreground">
                      {r.user.email}
                      {r.user.username ? ` · @${r.user.username}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      {tg ? (
                        <a href={`https://t.me/${tg}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[#2AABEE] hover:border-[#2AABEE]/50">
                          <TelegramIcon className="size-3.5" /> @{tg}
                        </a>
                      ) : (
                        <span className="rounded-full border border-dashed border-border px-2.5 py-1 text-muted-foreground">Telegram ko‘rsatilmagan</span>
                      )}
                      <Badge variant={st === "PRO_ACTIVE" ? "success" : "secondary"}>{SUBSCRIPTION_LABELS[st]}</Badge>
                      {st === "PRO_ACTIVE" && r.user.subscription?.expiresAt && <span className="text-muted-foreground">{formatDate(r.user.subscription.expiresAt)} gacha</span>}
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:flex sm:gap-8">
                    <div>
                      <dt className="text-xs text-muted-foreground">Narx</dt>
                      <dd className="font-mono font-semibold">
                        {formatPrice(r.price)} {r.currency}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{tab === "PENDING" ? "Ariza vaqti" : "Ko‘rib chiqilgan"}</dt>
                      <dd className="font-mono text-xs">{formatDateTime(tab === "PENDING" ? r.createdAt : (r.handledAt ?? r.createdAt))}</dd>
                    </div>
                    {r.attempts > 1 && tab === "PENDING" && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Bosishlar</dt>
                        <dd className="font-mono text-xs">{r.attempts} marta</dd>
                      </div>
                    )}
                    {r.handledBy && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Kim</dt>
                        <dd className="text-xs">{r.handledBy.name}</dd>
                      </div>
                    )}
                  </dl>
                  {tab === "PENDING" && (
                    <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
                      <ApproveRequestButton requestId={r.id} userName={r.user.name} defaultDays={pricing.defaultDurationDays} />
                      <RejectRequestButton requestId={r.id} />
                    </div>
                  )}
                </div>
                {r.note && <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs text-muted-foreground">Izoh: {r.note}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
