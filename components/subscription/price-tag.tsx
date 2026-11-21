import { discountPercent, formatPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/** Old price struck through, current price prominent. Sizes: "lg" (pricing card) / "md" (inline). */
export function PriceTag({
  price,
  oldPrice,
  currency,
  period,
  size = "md",
  className,
}: {
  price: number;
  oldPrice: number | null;
  currency: string;
  period?: string;
  size?: "md" | "lg";
  className?: string;
}) {
  const discount = discountPercent(price, oldPrice);
  return (
    <div className={cn("flex flex-wrap items-end gap-x-3 gap-y-1", className)} data-testid="price-tag">
      {oldPrice && oldPrice > price ? (
        <del className={cn("font-mono text-muted-foreground no-underline line-through decoration-destructive/80 decoration-2", size === "lg" ? "text-lg" : "text-sm")} data-testid="old-price">
          <span className="sr-only">Avvalgi narx: </span>
          {formatPrice(oldPrice)} {currency}
        </del>
      ) : null}
      <span className="flex items-baseline gap-1.5">
        <span className="sr-only">Hozirgi narx: </span>
        <span className={cn("font-mono font-bold tracking-tight text-foreground", size === "lg" ? "text-4xl sm:text-5xl" : "text-2xl")} data-testid="current-price">{formatPrice(price)}</span>
        <span className={cn("font-semibold text-gold-soft", size === "lg" ? "text-lg" : "text-sm")}>
          {currency}
          {period ? ` / ${period}` : ""}
        </span>
      </span>
      {discount ? (
        <span className="mb-1 rounded-full bg-success/15 px-2 py-0.5 font-mono text-xs font-bold text-success" aria-label={`${discount} foiz chegirma`}>
          −{discount}%
        </span>
      ) : null}
    </div>
  );
}
