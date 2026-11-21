import Link from "next/link";
import { ArrowRightIcon, CrownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import { Eyebrow } from "@/components/shared/page-header";
import { GrowthPath } from "./growth-path";

export function Hero({
  title,
  slogan,
  description,
  primaryCta,
  secondaryCta,
  primaryHref,
  counts,
}: {
  title: string;
  slogan: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  primaryHref: string;
  counts: { lessons: number; books: number; challenges: number };
}) {
  return (
    <section className="relative isolate overflow-hidden border-b border-border">
      <div aria-hidden className="chart-grid absolute inset-0 -z-10" />
      <div aria-hidden className="absolute -top-48 right-[-10%] -z-10 size-[42rem] rounded-full bg-primary/[0.08] blur-3xl" />
      <div aria-hidden className="absolute bottom-[-30%] left-[-15%] -z-10 size-[36rem] rounded-full bg-success/[0.04] blur-3xl" />

      <div className="mx-auto grid grid-cols-1 max-w-7xl items-center gap-12 px-4 pt-14 pb-16 sm:px-6 md:pt-20 lg:grid-cols-[1.02fr_1fr] lg:gap-10 lg:px-8 lg:pt-24 lg:pb-24">
        <div className="animate-in fade-in-0 slide-in-from-bottom-3 duration-700 fill-mode-both">
          <Eyebrow>AU Forex Academy</Eyebrow>
          <h1 className="mt-6 font-display text-[2.15rem] leading-[1.04] font-extrabold tracking-[-0.025em] text-foreground sm:text-5xl lg:text-[3.6rem] xl:text-[4rem]">
            {title}
          </h1>
          <p className="mt-5 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            <span className="gold-text">{slogan}</span>
          </p>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="xl" className="group">
              <Link href={primaryHref}>
                {primaryCta}
                <ArrowRightIcon className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline">
              <Link href="/subscription">
                <CrownIcon className="text-gold-soft" />
                {secondaryCta}
              </Link>
            </Button>
          </div>

          <dl className="mt-10 grid max-w-md grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-surface/60 backdrop-blur" aria-label="Platformadagi joriy materiallar">
            {[
              { label: "video dars", value: counts.lessons },
              { label: "kitob", value: counts.books },
              { label: "faol challenge", value: counts.challenges },
            ].map((s) => (
              <div key={s.label} className="px-4 py-3.5">
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <AnimatedCounter value={s.value} className="font-mono text-2xl font-semibold text-foreground" />
                  <span className="mt-0.5 block text-xs text-muted-foreground">{s.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <figure className="relative">
          <div className="glass relative overflow-hidden rounded-3xl border border-border-strong shadow-[0_40px_80px_-40px_rgb(0_0_0/0.9)]">
            <div aria-hidden className="hairline-top absolute inset-x-0 top-0 h-px" />
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <span className="font-mono text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">O‘quv yo‘li</span>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-gold-soft">0 → NATIJA</span>
            </div>
            <div className="aspect-[800/420] px-1 py-3 sm:px-3">
              <GrowthPath />
            </div>
          </div>
          <figcaption className="mt-3 text-center font-mono text-[11px] tracking-wide text-muted-foreground/70">
            Dekorativ tasvir — real bozor narxlarini ko‘rsatmaydi
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
