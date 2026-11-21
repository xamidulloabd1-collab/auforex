import Image from "next/image";
import Link from "next/link";
import {
  ArrowRightIcon,
  BrainCircuitIcon,
  CandlestickChartIcon,
  CheckIcon,
  ClipboardListIcon,
  CrownIcon,
  GaugeIcon,
  LineChartIcon,
  ListChecksIcon,
  NotebookPenIcon,
  UserRoundIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/page-header";
import { Reveal, Stagger, StaggerItem } from "@/components/shared/reveal";
import { CHALLENGE_TYPE_LABELS } from "@/lib/constants";
import { PriceTag } from "@/components/subscription/price-tag";

const INSTRUMENTS = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD", "BTC/USD", "US30"];
const TIMEFRAMES = ["5m", "15m", "1H", "4H", "1D", "1W"];

export function TradingViewIntro() {
  return (
    <section className="py-14 sm:py-20 md:py-28" aria-labelledby="tv-intro-title">
      <div className="mx-auto grid grid-cols-1 max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="TradingView"
            title={<span id="tv-intro-title">Grafiklar bilan amaliyot</span>}
            description="Ro‘yxatdan o‘tgan foydalanuvchilar platformaning o‘zida TradingView interaktiv grafiklarini ochib, instrument va timeframe’larni tanlab tahlil qilishni mashq qila oladi."
          />
          <ul className="mt-8 grid gap-3 text-[15px]">
            {[
              "Valyuta juftliklari, oltin, indekslar va kriptovalyutalar",
              "Timeframe tanlash va chizish vositalari",
              "Asosiy bozor atamalari bo‘yicha qisqa lug‘at",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 text-muted-foreground">
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" /> {t}
              </li>
            ))}
          </ul>
          <Button asChild className="mt-9" variant="secondary">
            <Link href="/tradingview">
              <LineChartIcon /> Grafiklarni ochish
            </Link>
          </Button>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="card-surface overflow-hidden" aria-hidden>
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
              {INSTRUMENTS.map((s, i) => (
                <span
                  key={s}
                  className={
                    i === 0
                      ? "rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-xs font-semibold text-gold-soft"
                      : "rounded-lg border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground"
                  }
                >
                  {s}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1 border-b border-border px-4 py-2">
              {TIMEFRAMES.map((t, i) => (
                <span key={t} className={i === 2 ? "rounded-md bg-card-elevated px-2 py-0.5 font-mono text-[11px] text-foreground" : "px-2 py-0.5 font-mono text-[11px] text-muted-foreground"}>
                  {t}
                </span>
              ))}
            </div>
            <div className="relative h-64 bg-surface">
              <div className="chart-grid absolute inset-0 opacity-60" />
              <svg viewBox="0 0 400 200" className="absolute inset-0 size-full" preserveAspectRatio="none">
                {Array.from({ length: 26 }).map((_, i) => {
                  const base = 150 - i * 3.4 + Math.sin(i * 1.7) * 14;
                  const up = Math.sin(i * 2.3) > -0.35;
                  const h = 10 + Math.abs(Math.cos(i * 1.3)) * 22;
                  return (
                    <g key={i}>
                      <line x1={12 + i * 15} x2={12 + i * 15} y1={base - h - 8} y2={base + 8} stroke={up ? "#22C55E" : "#E5484D"} strokeOpacity="0.5" />
                      <rect x={8 + i * 15} y={base - h} width="8" height={h} rx="1.5" fill={up ? "#22C55E" : "#E5484D"} fillOpacity="0.8" />
                    </g>
                  );
                })}
              </svg>
              <span className="absolute right-3 bottom-3 rounded-md border border-border bg-background/80 px-2 py-1 font-mono text-[10px] text-muted-foreground">Namuna ko‘rinish</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const CHALLENGE_ICONS = {
  QUIZ: ListChecksIcon,
  CHART_ANALYSIS: CandlestickChartIcon,
  RISK_ASSESSMENT: GaugeIcon,
  DEMO_JOURNAL: NotebookPenIcon,
  PSYCHOLOGY: BrainCircuitIcon,
  MARKET_ANALYSIS: ClipboardListIcon,
} as const;

export function ChallengeIntro({ activeCount }: { activeCount: number }) {
  return (
    <section className="border-y border-border bg-surface/40 py-14 sm:py-20 md:py-24" aria-labelledby="challenge-intro-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            eyebrow="Challenge"
            title={<span id="challenge-intro-title">Bilimni sinovdan o‘tkazing</span>}
            description="Challenge’lar ta’limiy: testlar, grafik tahlili, risk hisob-kitoblari va demo-jurnal topshiriqlari. Real pul kiritish talab qilinmaydi. Mukofotlar faqat admin e’lon qilgan shartlar asosida beriladi."
          />
          <Button asChild variant="outline">
            <Link href="/challenge">
              {activeCount > 0 ? `Faol challenge’lar (${activeCount})` : "Challenge bo‘limi"} <ArrowRightIcon />
            </Link>
          </Button>
        </div>
        <Stagger className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {(Object.keys(CHALLENGE_TYPE_LABELS) as (keyof typeof CHALLENGE_TYPE_LABELS)[]).map((k) => {
            const Icon = CHALLENGE_ICONS[k];
            return (
              <StaggerItem key={k}>
                <div className="card-surface flex h-full flex-col gap-4 p-5 transition-colors hover:border-primary/40">
                  <Icon className="size-5 text-gold-soft" />
                  <p className="font-display text-sm font-semibold leading-snug">{CHALLENGE_TYPE_LABELS[k]}</p>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}

export function ProBenefits({
  headline,
  benefits,
  comingSoon,
  price,
}: {
  headline: string;
  benefits: string[];
  comingSoon: string;
  price: { price: number; oldPrice: number | null; currency: string; period: string };
}) {
  return (
    <section className="py-14 sm:py-20 md:py-28" aria-labelledby="pro-benefits-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-[radial-gradient(90%_120%_at_100%_0%,rgb(201_164_92/0.14),transparent_55%),linear-gradient(180deg,#151D2B,#101723)] p-8 sm:p-12 lg:p-16">
            <div aria-hidden className="hairline-top absolute inset-x-0 top-0 h-px" />
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs font-semibold tracking-[0.2em] text-gold-soft uppercase">
                  <CrownIcon className="size-3.5" /> PRO
                </p>
                <h2 id="pro-benefits-title" className="mt-5 font-display text-3xl font-extrabold md:text-[2.5rem] md:leading-[1.1]">
                  {headline} — barcha materiallarga to‘liq kirish
                </h2>
                <PriceTag className="mt-6" price={price.price} oldPrice={price.oldPrice} currency={price.currency} period={price.period} />
                <Button asChild size="lg" className="mt-5 w-full sm:w-auto">
                  <Link href="/subscription">
                    <CrownIcon /> PRO sotib olish
                  </Link>
                </Button>
                <p className="mt-4 text-sm text-muted-foreground">{comingSoon}</p>
              </div>
              <ul className="grid gap-3">
                {benefits.map((b) => (
                  <li key={b} className="flex items-center gap-4 rounded-2xl border border-border bg-background/40 px-5 py-4 text-base font-medium">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-success text-success-foreground">
                      <CheckIcon className="size-4" strokeWidth={3} />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function FounderPreview({ name, role, message, portraitUrl }: { name: string; role: string; message: string; portraitUrl: string | null }) {
  const hasProfile = Boolean(name);
  return (
    <section className="border-y border-border bg-surface/40 py-14 sm:py-20 md:py-24" aria-labelledby="founder-preview-title">
      <div className="mx-auto grid grid-cols-1 max-w-7xl items-center gap-10 px-4 sm:px-6 md:grid-cols-[auto_1fr] lg:gap-16 lg:px-8">
        <Reveal>
          <div className="relative mx-auto size-48 overflow-hidden rounded-[2rem] border border-border-strong bg-card sm:size-56">
            {portraitUrl ? (
              <Image src={portraitUrl} alt={name || "Founder"} fill sizes="224px" className="object-cover" />
            ) : (
              <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_50%_30%,#1A2436,#101723)]">
                <UserRoundIcon className="size-20 text-border-strong" strokeWidth={1.2} />
              </div>
            )}
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.22em] text-gold-soft uppercase">
            <span aria-hidden className="h-px w-6 bg-gradient-to-r from-transparent to-primary" /> Founder
          </p>
          <h2 id="founder-preview-title" className="mt-4 font-display text-3xl font-extrabold md:text-4xl">
            {hasProfile ? name : "Akademiya asoschisi"}
          </h2>
          {role && <p className="mt-2 text-muted-foreground">{role}</p>}
          <p className="mt-5 max-w-2xl text-[15.5px] leading-relaxed text-muted-foreground">
            {message || "Founder haqidagi ma’lumotlar tez orada shu yerda e’lon qilinadi."}
          </p>
          <Button asChild variant="outline" className="mt-7">
            <Link href="/founder">
              Founder sahifasi <ArrowRightIcon />
            </Link>
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
