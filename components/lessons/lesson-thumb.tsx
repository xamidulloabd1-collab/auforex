import Image from "next/image";
import { PlayIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Lesson thumbnail or a branded placeholder (no stock imagery). */
export function LessonThumb({ url, title, className, sizes = "(max-width: 768px) 100vw, 400px" }: { url: string | null; title: string; className?: string; sizes?: string }) {
  return (
    <div className={cn("relative aspect-video overflow-hidden rounded-xl border border-border bg-surface", className)}>
      {url ? (
        <Image src={url} alt="" fill sizes={sizes} className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_80%_0%,rgb(201_164_92/0.14),transparent_60%),linear-gradient(180deg,#121A27,#0C111B)]">
          <div aria-hidden className="chart-grid absolute inset-0 opacity-40" />
          <svg aria-hidden viewBox="0 0 160 90" className="absolute inset-x-0 bottom-0 h-1/2 w-full text-primary/40" preserveAspectRatio="none">
            <path d="M0 80 L25 70 L40 74 L65 52 L80 58 L105 36 L120 40 L160 14" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <p className="absolute top-3 left-3 line-clamp-2 max-w-[70%] font-display text-xs font-semibold text-foreground/70">{title}</p>
        </div>
      )}
      <span className="absolute right-3 bottom-3 grid size-10 place-items-center rounded-full border border-white/10 bg-black/50 text-foreground backdrop-blur transition group-hover:border-primary/50 group-hover:text-gold-soft">
        <PlayIcon className="size-4 translate-x-px" fill="currentColor" />
      </span>
    </div>
  );
}
