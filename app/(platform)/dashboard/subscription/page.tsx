import type { Metadata } from "next";
import Link from "next/link";
import { CalendarIcon, ClockIcon, CrownIcon, InfinityIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getSetting } from "@/lib/settings";
import { SUBSCRIPTION_LABELS } from "@/lib/subscription/entitlement";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashTitle, StatCard } from "@/components/dashboard/stat-card";
import { PriceTag } from "@/components/subscription/price-tag";
import { BuyProButton } from "@/components/subscription/buy-pro-button";

export const metadata: Metadata = { title: "Obuna", robots: { index: false } };

export default async function MySubscriptionPage() {
  const viewer = await requireUser("/dashboard/subscription");
  const s = viewer.subscription;
  const active = s.status === "PRO_ACTIVE";
  const [pricing, pendingRequest] = await Promise.all([
    getSetting("subscription"),
    prisma.proRequest.findFirst({ where: { userId: viewer.id, status: "PENDING" }, select: { createdAt: true } }),
  ]);

  return (
    <>
      <DashTitle title="Mening obunam" description="Joriy tarif va PRO holati." />
      <section className={`relative overflow-hidden rounded-[1.75rem] border p-5 sm:p-9 ${active ? "border-primary/40 bg-[radial-gradient(80%_120%_at_100%_0%,rgb(201_164_92/0.16),transparent_60%),#151D2B]" : "border-border bg-card"}`}>
        <div className="flex flex-wrap items-center gap-3">
          <CrownIcon className={active ? "size-6 text-gold-soft" : "size-6 text-muted-foreground"} />
          <p className="font-display text-2xl font-extrabold">{active ? "PRO" : "Bepul tarif"}</p>
          <Badge variant={active ? "success" : "secondary"} data-testid="subscription-badge">
            {SUBSCRIPTION_LABELS[s.status]}
          </Badge>
        </div>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          {active
            ? "Barcha videodarsliklar, kitoblar va challenge’lar siz uchun ochiq."
            : s.status === "PRO_EXPIRED"
              ? "PRO muddati tugagan. Premium materiallar yopiq."
              : s.status === "PRO_CANCELLED"
                ? "PRO obuna bekor qilingan. Premium materiallar yopiq."
                : "Hozir bepul tarifdasiz. Premium materiallar PRO tarifda."}
        </p>
        {viewer.isAdmin && <p className="mt-2 text-xs text-gold-soft">Administrator sifatida barcha materiallarni ko‘ra olasiz.</p>}
      </section>

      {pendingRequest && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/[0.06] p-4 text-sm" data-testid="pending-request-note">
          <ClockIcon className="mt-0.5 size-4 shrink-0 text-gold-soft" />
          <p>
            <span className="font-semibold">Arizangiz ko‘rib chiqilmoqda.</span>{" "}
            <span className="text-muted-foreground">To‘lov Telegram’da tasdiqlangach PRO shu hisobda avtomatik ochiladi.</span>
          </p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Joriy tarif" value={active ? "PRO" : "FREE"} icon={<CrownIcon />} className="col-span-2 sm:col-span-1" />
        <StatCard label="Boshlangan sana" value={<span className="text-xl">{s.startedAt ? formatDate(s.startedAt) : "—"}</span>} icon={<CalendarIcon />} />
        <StatCard
          label="Tugash sanasi"
          value={<span className="text-xl">{s.expiresAt ? formatDate(s.expiresAt) : active ? "Muddatsiz" : "—"}</span>}
          icon={s.expiresAt || !active ? <CalendarIcon /> : <InfinityIcon />}
        />
      </div>

      {!viewer.isAdmin && (
        <div className="mt-8 grid gap-5 rounded-2xl border border-border bg-surface p-5 sm:p-6 md:grid-cols-[1fr_auto] md:items-center" data-testid="upgrade-card">
          <div>
            <p className="font-display text-lg font-bold">{active ? "PRO muddatini uzaytirish" : "PRO tarifga o‘tish"}</p>
            <div className="mt-3">
              <PriceTag price={pricing.price} oldPrice={pricing.oldPrice} currency={pricing.currency} period={pricing.period} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{pricing.comingSoonText}</p>
          </div>
          <div className="grid gap-2 md:w-72">
            <BuyProButton purchaseUrl={pricing.purchaseUrl} label={active ? "PRO’ni uzaytirish" : pricing.purchaseButton} isGuest={false} hasPendingRequest={Boolean(pendingRequest)} />
            {!active && (
              <Button asChild variant="ghost" size="sm" data-testid="upgrade-button">
                <Link href="/subscription">PRO imkoniyatlari bilan tanishish</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
