import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "h-11 w-full appearance-none rounded-xl border border-input bg-surface pr-10 pl-3.5 text-base text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-primary/70 focus-visible:ring-3 focus-visible:ring-primary/15 disabled:opacity-50 aria-invalid:border-destructive/70 md:text-sm [&>option]:bg-popover",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export { NativeSelect };
