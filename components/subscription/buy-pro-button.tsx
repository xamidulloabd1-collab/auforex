"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, CrownIcon } from "lucide-react";
import { toast } from "sonner";
import { createProRequest } from "@/lib/actions/pro-request";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { TelegramIcon } from "@/components/shared/brand-icons";

/**
 * Opens the founder's Telegram in a new tab and, at the same time, records a PRO request
 * that appears in the super admin panel. Guests are asked to create an account first so
 * the request can be matched to them.
 */
export function BuyProButton({
  purchaseUrl,
  label,
  isGuest,
  hasPendingRequest,
  className,
}: {
  purchaseUrl: string;
  label: string;
  isGuest: boolean;
  hasPendingRequest: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [sent, setSent] = React.useState(hasPendingRequest);

  if (isGuest) {
    return (
      <div className={cn("grid gap-3", className)}>
        <Link href="/register?next=%2Fsubscription" className={buttonVariants({ size: "xl", className: "w-full" })} data-testid="buy-pro-guest">
          <CrownIcon /> Ro‘yxatdan o‘tish va sotib olish
        </Link>
        <p className="text-center text-sm text-muted-foreground">
          Hisobingiz bormi?{" "}
          <Link href="/login?next=%2Fsubscription" className="font-semibold text-gold-soft underline-offset-4 hover:underline">
            Kirish
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className={cn("grid gap-3", className)}>
      <a
        href={purchaseUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ size: "xl", className: "w-full" })}
        data-testid="buy-pro"
        onClick={() => {
          // The link opens Telegram immediately; the request is recorded in parallel.
          void createProRequest().then((res) => {
            if (!res.ok) {
              toast.error(res.error);
              return;
            }
            setSent(true);
            toast.success(res.data?.status === "pending" ? "Arizangiz allaqachon qabul qilingan" : "Arizangiz qabul qilindi");
            router.refresh();
          });
        }}
      >
        <TelegramIcon className="size-5" /> {label}
      </a>
      {sent && (
        <p className="flex items-start gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-green-200" role="status" data-testid="pro-request-sent">
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
          <span>
            Arizangiz yuborildi. To‘lovni Telegram’da yakunlang — u tasdiqlangach, PRO hisobingizda avtomatik ochiladi.{" "}
            <a href={purchaseUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
              Telegram’ni ochish
            </a>
          </span>
        </p>
      )}
    </div>
  );
}
