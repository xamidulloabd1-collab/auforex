import type { Metadata } from "next";
import { CheckIcon, CrownIcon, ShieldCheckIcon } from "lucide-react";
import { getViewer } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getSetting } from "@/lib/settings";
import { SUBSCRIPTION_LABELS } from "@/lib/subscription/entitlement";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { Reveal } from "@/components/shared/reveal";
import { RiskDisclaimer } from "@/components/shared/risk-disclaimer";
import { BuyProButton } from "@/components/subscription/buy-pro-button";
import { PriceTag } from "@/components/subscription/price-tag";

export const metadata: Metadata = {
  title: "PRO obuna",
  description: "AU Forex Academy PRO tarifi: barcha videodarsliklar, kitoblar va challenge’lar.",
};

const STEPS = [
  { title: "Tugmani bosing", text: "Arizangiz qayd etiladi va asoschining Telegram sahifasi ochiladi." },
  { title: "Telegram’da to‘lang", text: "To‘lov tafsilotlarini Telegram orqali kelishib olasiz." },
  { title: "PRO ochiladi", text: "To‘lov tasdiqlangach, PRO shu hisobingizda darhol faollashadi." },
];

export default async function SubscriptionPage() {
  const [viewer, subscription] = await Promise.all([getViewer(), getSetting("subscription")]);
  const status = viewer?.subscription.status;
  const isActive = status === "PRO_ACTIVE";
  const pending = viewer
    ? await prisma.proRequest.findFirst({ where: { userId: viewer.id, status: "PENDING" }, select: { createdAt: true } })
    : null;

  return (
    <>
      <PageHeader eyebrow="Obuna" title={subscription.headline} description={subscription.description} />
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-8 sm:px-6 md:py-14 lg:grid-cols-[1fr_1.05fr] lg:gap-8 lg:px-8">
        {/* Purchase card first on phones */}
        <Reveal className="lg:order-2">
          <section
            className="relative overflow-hidden rounded-[1.75rem] border border-primary/35 bg-[radial-gradient(90%_100%_at_100%_0%,rgb(201_164_92/0.18),transparent_55%),linear-gradient(180deg,#151D2B,#101723)] p-5 sm:p-9"
            aria-labelledby="buy-title"
            data-testid="purchase-card"
          >
            <div aria-hidden className="hairline-top absolute inset-x-0 top-0 h-px" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs font-semibold tracking-[0.2em] text-gold-soft uppercase">
                <CrownIcon className="size-3.5" /> PRO tarif
              </p>
              {viewer && status && (
                <Badge variant={isActive ? "success" : "secondary"} data-testid="subscription-status">
                  Joriy holat: {SUBSCRIPTION_LABELS[status]}
                </Badge>
              )}
            </div>
            <h2 id="buy-title" className="sr-only">
              PRO sotib olish
            </h2>
            <PriceTag
              className="mt-6"
              size="lg"
              price={subscription.price}
              oldPrice={subscription.oldPrice}
              currency={subscription.currency}
              period={subscription.period}
            />
            {isActive && (
              <p className="mt-4 text-sm text-green-200">
                PRO obunangiz faol{viewer?.subscription.expiresAt ? ` — ${formatDate(viewer.subscription.expiresAt)} gacha` : ""}. Muddatni uzaytirish uchun ham shu tugmadan foydalaning.
              </p>
            )}
            <BuyProButton
              className="mt-6"
              purchaseUrl={subscription.purchaseUrl}
              label={isActive ? "PRO’ni uzaytirish" : subscription.purchaseButton}
              isGuest={!viewer}
              hasPendingRequest={Boolean(pending)}
            />
            <ol className="mt-7 grid gap-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-primary/40 font-mono text-xs font-bold text-gold-soft">{i + 1}</span>
                  <span className="text-sm leading-relaxed">
                    <span className="font-semibold text-foreground">{s.title}.</span> <span className="text-muted-foreground">{s.text}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
              {subscription.comingSoonText} Platforma karta ma’lumotlarini so‘ramaydi va saqlamaydi.
            </p>
          </section>
        </Reveal>

        <Reveal delay={0.1} className="lg:order-1">
          <section className="card-surface h-full p-5 sm:p-9" aria-labelledby="plan-title">
            <h2 id="plan-title" className="font-display text-2xl font-extrabold sm:text-3xl">
              PRO bilan nimalar ochiladi
            </h2>
            <ul className="mt-6 grid gap-3">
              {subscription.benefits.map((b) => (
                <li key={b} className="flex items-center gap-4 rounded-2xl border border-border bg-background/40 px-4 py-3.5 text-[15px] font-medium sm:px-5 sm:py-4 sm:text-base">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-success text-success-foreground">
                    <CheckIcon className="size-4" strokeWidth={3} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted-foreground">{subscription.contactNote}</p>
          </section>
        </Reveal>
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <RiskDisclaimer />
      </div>
    </>
  );
}
