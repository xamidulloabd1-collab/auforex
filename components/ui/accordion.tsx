"use client";

import * as React from "react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import { PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const Accordion = AccordionPrimitive.Root;

function AccordionItem({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item className={cn("border-b border-border last:border-b-0", className)} {...props} />;
}

function AccordionTrigger({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          "group flex flex-1 items-center justify-between gap-4 py-5 text-left font-display text-base font-semibold transition-colors outline-none hover:text-gold-soft focus-visible:text-gold-soft md:text-lg",
          className,
        )}
        {...props}
      >
        {children}
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border-strong transition-[transform,border-color,background-color] duration-300 group-hover:border-primary/60 group-data-[state=open]:rotate-45 group-data-[state=open]:border-primary/60 group-data-[state=open]:bg-primary/10">
          <PlusIcon className="size-4 text-gold-soft" />
        </span>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      className="overflow-hidden text-[15px] leading-relaxed text-muted-foreground data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn("pr-12 pb-5", className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
