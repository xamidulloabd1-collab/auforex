import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-200 outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_0_0_rgb(255_255_255/0.25)_inset,0_8px_24px_-12px_rgb(201_164_92/0.6)] hover:bg-gold-soft",
        secondary: "bg-secondary text-secondary-foreground border border-border hover:bg-accent hover:border-border-strong",
        outline: "border border-border-strong bg-transparent text-foreground hover:bg-secondary hover:border-primary/50",
        ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
        destructive: "bg-destructive/90 text-destructive-foreground hover:bg-destructive",
        success: "bg-success text-success-foreground hover:bg-success/90",
        link: "text-primary underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        default: "h-11 px-4 md:h-10",
        sm: "h-9 rounded-lg px-3 text-xs md:h-8",
        lg: "h-12 px-6 text-[15px]",
        xl: "h-14 px-8 text-base",
        icon: "size-11 md:size-10",
        "icon-sm": "size-9 rounded-lg md:size-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
