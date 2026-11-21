import { cn } from "@/lib/utils";

export function AuthHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <p className="font-mono text-[11px] font-medium tracking-[0.24em] text-gold-soft uppercase">{eyebrow}</p>
      <h1 className="mt-3 font-display text-3xl font-extrabold">{title}</h1>
      {description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}

export function FormAlert({ tone = "error", children, className }: { tone?: "error" | "success" | "info"; children: React.ReactNode; className?: string }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl border px-4 py-3 text-sm leading-relaxed",
        tone === "error" && "border-destructive/30 bg-destructive/10 text-red-200",
        tone === "success" && "border-success/30 bg-success/10 text-green-200",
        tone === "info" && "border-border-strong bg-secondary text-secondary-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
