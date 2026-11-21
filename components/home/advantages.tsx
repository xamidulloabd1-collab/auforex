import { BookOpenIcon, PlayIcon, TrophyIcon } from "lucide-react";
import { SectionHeading } from "@/components/shared/page-header";
import { Stagger, StaggerItem } from "@/components/shared/reveal";

type Item = { title: string; description: string; liveLabel: string };

export function Advantages({ lessons, library, challenge }: { lessons: Item; library: Item; challenge: Item }) {
  const items = [
    { ...lessons, icon: PlayIcon },
    { ...library, icon: BookOpenIcon },
    { ...challenge, icon: TrophyIcon },
  ];
  return (
    <section className="border-y border-border bg-surface/40 py-14 sm:py-20 md:py-24" aria-labelledby="advantages-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Platforma afzalliklari" title={<span id="advantages-title">Bilim uchun hamma narsa bir joyda</span>} />
        <Stagger className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {items.map(({ icon: Icon, title, description, liveLabel }) => (
            <StaggerItem key={title}>
              <article className="group card-surface relative h-full overflow-hidden p-7 transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-primary/40">
                <div aria-hidden className="absolute -top-16 -right-16 size-40 rounded-full bg-primary/[0.06] blur-2xl transition-opacity duration-500 group-hover:opacity-100 md:opacity-0" />
                <div className="relative grid size-12 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-gold-soft">
                  <Icon className="size-5" />
                </div>
                <h3 className="relative mt-6 font-display text-xl font-bold">{title}</h3>
                <p className="relative mt-3 text-[15px] leading-relaxed text-muted-foreground">{description}</p>
                <p className="relative mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-success" aria-hidden />
                  {liveLabel}
                </p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
