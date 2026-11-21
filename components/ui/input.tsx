import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 rounded-xl border border-input bg-surface px-3.5 text-base text-foreground shadow-xs transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground/70 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:border-primary/70 focus-visible:ring-3 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive/70 aria-invalid:ring-destructive/15 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
