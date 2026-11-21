import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full rounded-xl border border-input bg-surface px-3.5 py-3 text-base leading-relaxed text-foreground shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-primary/70 focus-visible:ring-3 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive/70 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
