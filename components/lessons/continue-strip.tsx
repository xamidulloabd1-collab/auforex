import Link from "next/link";
import { PlayCircleIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function ContinueWatching({ items }: { items: { id: string; slug: string; title: string; courseTitle: string; progressPercent: number }[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="continue-title" className="mb-12">
      <h2 id="continue-title" className="font-mono text-[11px] font-medium tracking-[0.22em] text-muted-foreground uppercase">
        Davom ettirish
      </h2>
      <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {items.map((l) => (
          <li key={l.id}>
            <Link href={`/lessons/${l.slug}`} className="group card-surface flex items-center gap-4 p-4 transition-colors hover:border-primary/40">
              <PlayCircleIcon className="size-9 shrink-0 text-gold-soft transition-transform group-hover:scale-105" strokeWidth={1.4} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-muted-foreground">{l.courseTitle}</p>
                <p className="truncate font-display font-semibold">{l.title}</p>
                <Progress value={l.progressPercent} className="mt-2 h-1.5" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
