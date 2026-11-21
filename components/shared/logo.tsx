import Link from "next/link";
import { cn } from "@/lib/utils";

/** Monogram: three ascending candles — "0 dan natijagacha" as a mark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={cn("size-9", className)}>
      <defs>
        <linearGradient id="au-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E4CB93" />
          <stop offset="55%" stopColor="#C9A45C" />
          <stop offset="100%" stopColor="#8F6F33" />
        </linearGradient>
      </defs>
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="11" fill="#101723" stroke="url(#au-gold)" strokeOpacity="0.55" strokeWidth="1.5" />
      <line x1="11" y1="21" x2="11" y2="31" stroke="#C9A45C" strokeOpacity="0.55" strokeWidth="1.2" />
      <rect x="8.5" y="23" width="5" height="6" rx="1.2" fill="url(#au-gold)" opacity="0.7" />
      <line x1="20" y1="13" x2="20" y2="29" stroke="#C9A45C" strokeOpacity="0.7" strokeWidth="1.2" />
      <rect x="17.5" y="16" width="5" height="10" rx="1.2" fill="url(#au-gold)" opacity="0.85" />
      <line x1="29" y1="7" x2="29" y2="24" stroke="#C9A45C" strokeWidth="1.2" />
      <rect x="26.5" y="9" width="5" height="12" rx="1.2" fill="url(#au-gold)" />
    </svg>
  );
}

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("group flex items-center gap-2.5 rounded-xl outline-none", className)} aria-label="AU Forex Academy — bosh sahifa">
      <LogoMark className="transition-transform duration-300 group-hover:-translate-y-0.5" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[15px] font-extrabold tracking-[0.06em] text-foreground">AU FOREX</span>
        <span className="mt-1 font-mono text-[10px] font-medium tracking-[0.32em] text-gold-soft/90">ACADEMY</span>
      </span>
    </Link>
  );
}
