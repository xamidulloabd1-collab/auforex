"use client";

import * as React from "react";
import { CheckCircle2Icon, HardDriveIcon, Loader2Icon, MailIcon, XCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { checkStorageAction, sendTestEmailAction } from "@/lib/actions/admin/system";
import type { ProbeStep } from "@/lib/storage/probe";
import { Button } from "@/components/ui/button";

export type SystemSummary = {
  siteUrl: string;
  database: { pooled: boolean; poolMax: number };
  storage: { driver: "local" | "s3"; uploads: boolean; error?: string; bucket?: string; host?: string };
  mail: { configured: boolean; verificationRequired: boolean; host?: string };
};

function Row({ label, value, ok }: { label: string; value: React.ReactNode; ok?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-surface px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={ok === false ? "text-amber-300" : ok ? "text-success" : undefined}>{value}</span>
    </div>
  );
}

/** Super admin → Sozlamalar → Tizim: configuration summary (no secrets) and live checks. */
export function SystemStatus({ summary }: { summary: SystemSummary }) {
  const [checking, startCheck] = React.useTransition();
  const [mailing, startMail] = React.useTransition();
  const [steps, setSteps] = React.useState<ProbeStep[] | null>(null);
  const { storage, mail, database } = summary;

  return (
    <div className="grid gap-6" data-testid="system-status">
      <section className="grid gap-2">
        <h3 className="font-display text-base font-semibold">Umumiy</h3>
        <Row label="Sayt manzili (email havolalari)" value={summary.siteUrl} ok={summary.siteUrl.startsWith("https://")} />
        <Row label="Ma’lumotlar bazasi" value={`${database.pooled ? "pooled ulanish" : "to‘g‘ridan-to‘g‘ri"} · pool ${database.poolMax}`} />
      </section>

      <section className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold">
            <HardDriveIcon className="size-4" /> Fayl ombori
          </h3>
          <Button
            size="sm"
            variant="secondary"
            disabled={checking || storage.driver !== "s3" || Boolean(storage.error)}
            data-testid="check-storage"
            onClick={() =>
              startCheck(async () => {
                const res = await checkStorageAction();
                if (!res.ok) return void toast.error(res.error);
                setSteps(res.data?.steps ?? []);
                if (res.data?.steps.every((s) => s.ok)) toast.success(res.message ?? "Joyida");
                else toast.error(res.message ?? "Xato bor");
              })
            }
          >
            {checking ? <Loader2Icon className="animate-spin" /> : <HardDriveIcon />} Omborni tekshirish
          </Button>
        </div>
        <Row
          label="Saqlash joyi"
          value={storage.driver === "s3" ? `R2/S3 · ${storage.host ?? ""} · ${storage.bucket ?? ""}` : "server diski (lokal)"}
          ok={storage.driver === "s3" && !storage.error}
        />
        <Row label="Yuklash" value={storage.error ?? (storage.uploads ? "ishlaydi" : "o‘chiq (Vercel’da R2 kerak)")} ok={storage.uploads && !storage.error} />
        {steps && (
          <ul className="grid gap-1.5 text-sm" data-testid="storage-check-report">
            {steps.map((s) => (
              <li key={s.name} className="flex items-start gap-2 rounded-lg bg-surface px-3 py-2">
                {s.ok ? <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-success" /> : <XCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />}
                <span>
                  {s.name}
                  {s.detail && <span className="block text-xs text-muted-foreground">{s.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold">
            <MailIcon className="size-4" /> Pochta (SMTP)
          </h3>
          <Button
            size="sm"
            variant="secondary"
            disabled={mailing || !mail.configured}
            data-testid="send-test-email"
            onClick={() =>
              startMail(async () => {
                const res = await sendTestEmailAction();
                if (res.ok) toast.success(res.message ?? "Yuborildi");
                else toast.error(res.error);
              })
            }
          >
            {mailing ? <Loader2Icon className="animate-spin" /> : <MailIcon />} Menga test xat yuborish
          </Button>
        </div>
        <Row label="SMTP" value={mail.configured ? `sozlangan · ${mail.host ?? ""}` : "sozlanmagan"} ok={mail.configured} />
        <Row label="Email tasdiqlash" value={mail.verificationRequired ? "majburiy" : "o‘chiq"} />
      </section>
      <p className="text-xs text-muted-foreground">Kalit va parollar bu yerda ko‘rsatilmaydi. Sozlash: docs/FAYL-SAQLASH.md va docs/EMAIL.md.</p>
    </div>
  );
}
