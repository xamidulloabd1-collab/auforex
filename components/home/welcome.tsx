import { Reveal } from "@/components/shared/reveal";
import { Eyebrow } from "@/components/shared/page-header";

export function Welcome({ title, text, signature }: { title: string; text: string; signature: string | null }) {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const closing = paragraphs.at(-1)?.startsWith("0 dan natijagacha") ? paragraphs.pop() : null;
  const [lead, ...rest] = paragraphs;

  return (
    <section className="relative py-14 sm:py-20 md:py-28" aria-labelledby="welcome-title">
      <div className="mx-auto grid grid-cols-1 max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
        <Reveal className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <Eyebrow>Xush kelibsiz</Eyebrow>
            <h2 id="welcome-title" className="mt-4 font-display text-3xl font-extrabold md:text-[2.5rem] md:leading-[1.1]">
              {title}
            </h2>
            <div aria-hidden className="mt-8 hidden h-40 w-px bg-gradient-to-b from-primary/60 to-transparent lg:block" />
          </div>
        </Reveal>
        <Reveal className="lg:col-span-8" delay={0.1}>
          <div className="relative rounded-3xl border border-border bg-card/70 p-6 sm:p-10">
            {lead && <p className="font-display text-xl leading-relaxed font-semibold text-foreground sm:text-2xl">{lead}</p>}
            <div className="prose-au mt-6 text-[15.5px] leading-[1.8] text-muted-foreground sm:text-base">
              {rest.map((p) => (
                <p key={p.slice(0, 32)}>{p}</p>
              ))}
            </div>
            {closing && (
              <p className="mt-8 border-t border-border pt-6 font-display text-xl font-bold">
                <span className="gold-text">{closing}</span>
              </p>
            )}
            {signature && <p className="mt-3 font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">— {signature}</p>}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
