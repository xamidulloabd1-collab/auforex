import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Book cover: the extracted/uploaded cover image when available, otherwise a
 * typographic cover generated from the real title (never a fake illustration).
 */
export function BookCover({
  title,
  author,
  coverUrl,
  className,
  sizes = "(max-width: 768px) 50vw, 240px",
  priority = false,
}: {
  title: string;
  author?: string | null;
  coverUrl: string | null;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative aspect-[1/1.414] overflow-hidden rounded-r-xl rounded-l-[4px] border border-border-strong bg-surface shadow-[0_30px_50px_-30px_rgb(0_0_0/0.9)]",
        className,
      )}
    >
      {coverUrl ? (
        <Image src={coverUrl} alt={`${title} — muqova`} fill sizes={sizes} className="object-cover" priority={priority} />
      ) : (
        <div className="absolute inset-0 flex flex-col justify-between bg-[linear-gradient(160deg,#151D2B_0%,#0C111B_60%,#101723_100%)] p-[9%]">
          <div aria-hidden className="chart-grid absolute inset-0 opacity-40" />
          <div className="relative">
            <div className="h-px w-10 bg-primary" />
            <p className="mt-3 font-mono text-[9px] tracking-[0.3em] text-gold-soft/80 uppercase">AU Forex Academy</p>
          </div>
          <p className="relative font-display text-[clamp(0.95rem,2.4vw,1.4rem)] leading-[1.15] font-extrabold text-foreground">{title}</p>
          <div className="relative flex items-end justify-between gap-2">
            <p className="text-[10px] text-muted-foreground">{author ?? ""}</p>
            <svg viewBox="0 0 40 24" className="h-5 w-8 text-primary" aria-hidden>
              <path d="M2 20 L12 14 L18 17 L28 7 L38 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      )}
      {/* spine highlight */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/40 to-transparent" />
    </div>
  );
}
