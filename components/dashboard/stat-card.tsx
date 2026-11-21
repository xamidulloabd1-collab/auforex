import { cn } from "@/lib/utils";

export function StatCard({ label, value, hint, icon, className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("card-surface p-5", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon && <span className="text-gold-soft [&_svg]:size-4">{icon}</span>}
      </div>
      <p className="mt-3 font-mono text-3xl font-semibold tracking-tight">{value}</p>
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function DashTitle({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
