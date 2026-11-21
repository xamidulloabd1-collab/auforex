import Link from "next/link";
import { CheckIcon, CrownIcon, LockKeyholeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSetting } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { PriceTag } from "./price-tag";

const DEFAULT_BENEFITS = ["Barcha videodarsliklar", "Foydali tradingga oid kitoblar", "Challenge’da qatnashish imkoniyati"];

/**
 * Reusable PRO restriction card (lessons, books, challenge).
 * Purely presentational: the server decides whether to render it, and protected
 * data/files are never sent to non-PRO users regardless of this component.
 */
export async function ProAccessGate({
  isGuest = false,
  benefits = DEFAULT_BENEFITS,
  className,
}: {
  isGuest?: boolean;
  benefits?: string[];
  className?: string;
}) {
  const pricing = await getSetting("subscription");
  return (
    <section
      aria-labelledby="pro-gate-title"
      className={cn("relative isolate mx-auto w-full max-w-2xl", className)}
      data-testid="pro-access-gate"
    >
      {/* Locked content silhouette */}
      <div aria-hidden className="absolute inset-x-6 -top-6 -z-10 grid grid-cols-3 gap-3 opacity-40 blur-[2px]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-border bg-card" />
        ))}
      </div>

      <div className="card-surface relative overflow-hidden px-5 py-8 text-center sm:px-12 sm:py-12">
        <div aria-hidden className="hairline-top absolute inset-x-0 top-0 h-px" />
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 size-64 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative mx-auto mb-6 grid size-16 place-items-center rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/15 to-transparent">
          <CrownIcon className="size-7 text-gold-soft" aria-hidden />
          <span className="absolute -right-2 -bottom-2 grid size-7 place-items-center rounded-full border border-border-strong bg-surface">
            <LockKeyholeIcon className="size-3.5 text-muted-foreground" aria-hidden />
          </span>
        </div>

        <h2 id="pro-gate-title" className="relative font-display text-2xl font-extrabold leading-tight text-balance sm:text-[1.75rem]">
          Ushbu bo‘limlar uchun PRO tarifga obuna bo‘lishingiz kerak
        </h2>

        <ul className="relative mx-auto mt-8 grid max-w-sm gap-3 text-left">
          {benefits.map((b) => (
            <li key={b} className="flex items-center gap-3 rounded-xl border border-border bg-surface/70 px-4 py-3 text-[15px] font-medium">
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-success text-success-foreground" aria-hidden>
                <CheckIcon className="size-4" strokeWidth={3} />
              </span>
              {b}
            </li>
          ))}
        </ul>

        <PriceTag
          className="relative mx-auto mt-8 max-w-sm justify-center"
          price={pricing.price}
          oldPrice={pricing.oldPrice}
          currency={pricing.currency}
          period={pricing.period}
        />

        <Button asChild size="xl" className="relative mt-5 w-full max-w-sm tracking-[0.08em]">
          <Link href="/subscription" data-testid="subscribe-button">
            OBUNA BO‘LISH
          </Link>
        </Button>

        {isGuest && (
          <p className="relative mt-5 text-sm text-muted-foreground">
            PRO obunangiz bormi?{" "}
            <Link href="/login" className="font-semibold text-gold-soft underline-offset-4 hover:underline">
              Hisobingizga kiring
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
