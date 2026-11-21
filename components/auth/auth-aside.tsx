import { Logo } from "@/components/shared/logo";
import { GrowthPath } from "@/components/home/growth-path";

export function AuthAside() {
  return (
    <aside className="relative hidden overflow-hidden border-r border-border bg-surface lg:flex lg:flex-col">
      <div aria-hidden className="chart-grid absolute inset-0 opacity-70" />
      <div aria-hidden className="absolute -bottom-40 -left-20 size-[32rem] rounded-full bg-primary/[0.07] blur-3xl" />
      <div className="relative flex flex-1 flex-col justify-between p-10 xl:p-14">
        <Logo />
        <div className="relative -mx-4 my-10 h-64 xl:h-80">
          <GrowthPath compact />
        </div>
        <div>
          <p className="font-display text-3xl font-extrabold leading-tight xl:text-4xl">
            0 dan natijagacha — <span className="gold-text">birga!</span>
          </p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            Sabr, intizom, to‘g‘ri fikrlash va riskni boshqarish — bilimni bosqichma-bosqich mustahkamlang.
          </p>
        </div>
      </div>
    </aside>
  );
}
