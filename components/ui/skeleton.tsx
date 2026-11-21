import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "rounded-xl bg-[linear-gradient(90deg,var(--muted)_0%,var(--card-elevated)_50%,var(--muted)_100%)] bg-[length:200%_100%] animate-shimmer",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
