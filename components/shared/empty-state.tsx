import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-dashed border-border-strong bg-card/60 px-6 py-14 text-center", className)}>
      <div aria-hidden className="chart-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto flex max-w-md flex-col items-center">
        {icon && (
          <div className="mb-5 grid size-14 place-items-center rounded-2xl border border-border-strong bg-surface text-gold-soft [&_svg]:size-6">
            {icon}
          </div>
        )}
        <h3 className="font-display text-lg font-bold">{title}</h3>
        {description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}
