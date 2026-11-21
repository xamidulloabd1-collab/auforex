import * as React from "react";
import { cn } from "@/lib/utils";

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.22em] text-gold-soft uppercase", className)}>
      <span aria-hidden className="h-px w-6 bg-gradient-to-r from-transparent to-primary" />
      {children}
    </p>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("relative overflow-hidden border-b border-border", className)}>
      <div aria-hidden className="chart-grid pointer-events-none absolute inset-0 opacity-60" />
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[48rem] -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl" />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12 md:flex-row md:items-end md:justify-between md:py-16 lg:px-8">
        <div className="max-w-2xl">
          {eyebrow && <Eyebrow className="mb-3 sm:mb-4">{eyebrow}</Eyebrow>}
          <h1 className="font-display text-[1.75rem] leading-tight font-extrabold text-foreground sm:text-4xl md:text-[2.75rem] md:leading-[1.08]">{title}</h1>
          {description && <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
      </div>
    </header>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <Eyebrow className={cn("mb-4", align === "center" && "justify-center")}>{eyebrow}</Eyebrow>}
      <h2 className="font-display text-3xl font-extrabold text-foreground md:text-[2.5rem] md:leading-[1.1]">{title}</h2>
      {description && <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">{description}</p>}
    </div>
  );
}

export function Container({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)} {...props} />;
}
