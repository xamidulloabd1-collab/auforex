import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-primary/30 bg-primary/10 text-gold-soft",
        secondary: "border-border bg-secondary text-secondary-foreground",
        success: "border-success/30 bg-success/10 text-success",
        destructive: "border-destructive/30 bg-destructive/10 text-red-300",
        warning: "border-warning/30 bg-warning/10 text-amber-300",
        outline: "border-border-strong text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
