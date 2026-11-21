import { SectionHeading } from "@/components/shared/page-header";
import { Stagger, StaggerItem } from "@/components/shared/reveal";

const STEPS = [
  { title: "Trading asoslari", text: "Bozor nima, narx qanday shakllanadi, asosiy atamalar." },
  { title: "Forex bozori", text: "Valyuta juftliklari, sessiyalar, spred, pip va lot." },
  { title: "Texnik tahlil", text: "Grafiklar, shamlar, bozor tuzilmasi, zonalar va likvidlik." },
  { title: "Fundamental tahlil", text: "Iqtisodiy kalendar va yangiliklarning narxga ta’siri." },
  { title: "Risk management", text: "Pozitsiya hajmi, stop-loss, risk/reward va kapitalni himoya qilish." },
  { title: "Psixologiya va amaliyot", text: "Intizom, trading jurnali, xatolardan xulosa va demo amaliyot." },
];

/** A real sequence, so numbered steps rise like the brand's 0 → natija path. */
export function Roadmap() {
  return (
    <section className="py-14 sm:py-20 md:py-28" aria-labelledby="roadmap-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="O‘quv yo‘li"
          title={<span id="roadmap-title">Noldan natijagacha — bosqichma-bosqich</span>}
          description="Har bir bosqich keyingisiga poydevor bo‘ladi. Shoshilmasdan, tartib bilan o‘rganing."
        />
        <Stagger className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end lg:gap-3" gap={0.1}>
          {STEPS.map((s, i) => (
            <StaggerItem key={s.title} className="h-full lg:h-auto">
              <div
                className="card-surface relative flex h-full flex-col p-5 lg:min-h-[var(--h)]"
                style={{ ["--h" as string]: `${200 + i * 34}px` }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-gold-soft">{String(i + 1).padStart(2, "0")}</span>
                  <span aria-hidden className="h-px flex-1 translate-x-2 bg-gradient-to-r from-border-strong to-transparent" />
                </div>
                <h3 className="mt-4 font-display text-base font-bold leading-snug">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                <div aria-hidden className="mt-auto pt-5">
                  <div className="h-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-gradient-to-r from-gold-deep to-primary" style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} />
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
