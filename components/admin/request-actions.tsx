"use client";

import * as React from "react";
import { CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { approveProRequest, rejectProRequest } from "@/lib/actions/admin/requests";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAction } from "./action-controls";

const DURATIONS = [
  { days: 30, label: "1 oy" },
  { days: 90, label: "3 oy" },
  { days: 180, label: "6 oy" },
  { days: 365, label: "1 yil" },
  { days: 0, label: "Muddatsiz" },
];

/** "To‘lov qabul qilindi" → PRO is activated for the user immediately. */
export function ApproveRequestButton({ requestId, userName, defaultDays }: { requestId: string; userName: string; defaultDays: number }) {
  const [open, setOpen] = React.useState(false);
  const [days, setDays] = React.useState(defaultDays);
  const [note, setNote] = React.useState("");
  const { pending, run } = useAction();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="success" className="w-full sm:w-auto" data-testid="approve-request">
          <CheckCircle2Icon /> To‘lov qabul qilindi — PRO ochish
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>PRO ochish</DialogTitle>
          <DialogDescription>
            {userName} uchun to‘lov tasdiqlanadi va PRO darhol faollashadi. Foydalanuvchi qayta kirishi shart emas.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>PRO muddati</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="PRO muddati">
              {DURATIONS.map((d) => (
                <button
                  key={d.days}
                  type="button"
                  role="radio"
                  aria-checked={days === d.days}
                  onClick={() => setDays(d.days)}
                  className={cn(
                    "min-h-11 rounded-xl border px-2 text-sm font-medium transition-colors",
                    days === d.days ? "border-primary/60 bg-primary/10 text-gold-soft" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">PRO faol bo‘lsa, muddat joriy tugash sanasidan boshlab uzaytiriladi.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`note-${requestId}`}>Izoh (ixtiyoriy)</Label>
            <Input id={`note-${requestId}`} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: Telegram orqali to‘landi" />
          </div>
          <Button
            variant="success"
            size="lg"
            disabled={pending}
            onClick={() => run(() => approveProRequest(requestId, { durationDays: days, note }), { onSuccess: () => setOpen(false) })}
            data-testid="approve-request-confirm"
          >
            {pending ? <Loader2Icon className="animate-spin" /> : <CheckCircle2Icon />} PRO’ni ochish
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RejectRequestButton({ requestId }: { requestId: string }) {
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const { pending, run } = useAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full sm:w-auto">
          Rad etish
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Arizani rad etasizmi?</DialogTitle>
          <DialogDescription>Foydalanuvchining PRO holati o‘zgarmaydi. U keyin yana ariza qoldirishi mumkin.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Sabab (ixtiyoriy)" aria-label="Sabab" />
          <Button variant="destructive" disabled={pending} onClick={() => run(() => rejectProRequest(requestId, note), { onSuccess: () => setOpen(false) })}>
            {pending && <Loader2Icon className="animate-spin" />} Rad etish
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
