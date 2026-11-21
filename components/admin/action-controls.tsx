"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/result";
import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { VariantProps } from "class-variance-authority";

export function useAction() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const run = React.useCallback(
    (fn: () => Promise<ActionResult<unknown>>, opts: { onSuccess?: () => void; refresh?: boolean; redirectTo?: string } = {}) =>
      startTransition(async () => {
        const res = await fn();
        if (res.ok) {
          if (res.message) toast.success(res.message);
          opts.onSuccess?.();
          if (opts.redirectTo) router.push(opts.redirectTo);
          else if (opts.refresh !== false) router.refresh();
        } else {
          toast.error(res.error);
        }
      }),
    [router],
  );
  return { pending, run };
}

/** Button that asks for confirmation before running a server action. */
export function ConfirmAction({
  action,
  title,
  description,
  confirmLabel = "Tasdiqlash",
  children,
  variant = "secondary",
  size = "sm",
  destructive = true,
  onDone,
  redirectTo,
  testId,
}: {
  action: () => Promise<ActionResult<unknown>>;
  title: string;
  description?: string;
  confirmLabel?: string;
  children: React.ReactNode;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  destructive?: boolean;
  onDone?: () => void;
  redirectTo?: string;
  testId?: string;
}) {
  const { pending, run } = useAction();
  const [open, setOpen] = React.useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} disabled={pending} data-testid={testId}>
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
          <AlertDialogAction
            className={destructive ? undefined : buttonVariants({ variant: "default" })}
            onClick={(e) => {
              e.preventDefault();
              run(action, {
                redirectTo,
                onSuccess: () => {
                  setOpen(false);
                  onDone?.();
                },
              });
            }}
            data-testid={testId ? `${testId}-confirm` : undefined}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Inline publish/unpublish switch. */
export function ActionSwitch({ checked, action, label }: { checked: boolean; action: (next: boolean) => Promise<ActionResult<unknown>>; label: string }) {
  const { pending, run } = useAction();
  const [value, setValue] = React.useState(checked);
  const [prevChecked, setPrevChecked] = React.useState(checked);
  if (checked !== prevChecked) {
    // Sync with the server value after a refresh (derived-state pattern, no effect needed).
    setPrevChecked(checked);
    setValue(checked);
  }
  return (
    <Switch
      checked={value}
      disabled={pending}
      aria-label={label}
      onCheckedChange={(next) => {
        setValue(next);
        run(() => action(next).then((r) => (r.ok ? r : (setValue(!next), r))));
      }}
    />
  );
}

export function ActionButton({
  action,
  children,
  ...props
}: { action: () => Promise<ActionResult<unknown>>; children: React.ReactNode } & Omit<React.ComponentProps<typeof Button>, "onClick" | "action">) {
  const { pending, run } = useAction();
  return (
    <Button {...props} disabled={pending || props.disabled} onClick={() => run(action)}>
      {pending && <Loader2Icon className="animate-spin" />}
      {children}
    </Button>
  );
}
