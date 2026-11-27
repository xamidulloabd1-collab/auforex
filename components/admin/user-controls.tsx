"use client";

import * as React from "react";
import { CrownIcon, Loader2Icon } from "lucide-react";
import { grantPro, markEmailVerified, revokePro, revokeUserSessions, setAccountStatus, setSubscriptionExpiry, setUserRole } from "@/lib/actions/admin/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmAction, useAction } from "./action-controls";

export function SubscriptionControls({ userId, isActive, expiresAt }: { userId: string; isActive: boolean; expiresAt: string }) {
  const { pending, run } = useAction();
  const [expiry, setExpiry] = React.useState(expiresAt);
  const [note, setNote] = React.useState("");

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="expiresAt">Tugash sanasi (ixtiyoriy)</Label>
          <Input id="expiresAt" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} data-testid="pro-expiry" />
          <p className="text-xs text-muted-foreground">Bo‘sh qoldirilsa — bekor qilinmaguncha muddatsiz.</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="note">Izoh (ixtiyoriy)</Label>
          <Input id="note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: Telegram orqali to‘lov" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => run(() => grantPro(userId, { expiresAt: expiry, note }))} data-testid="grant-pro">
          {pending ? <Loader2Icon className="animate-spin" /> : <CrownIcon />} {isActive ? "PRO’ni yangilash" : "PRO berish"}
        </Button>
        {isActive && (
          <Button variant="secondary" disabled={pending} onClick={() => run(() => setSubscriptionExpiry(userId, expiry))}>
            Faqat muddatni saqlash
          </Button>
        )}
        {isActive && (
          <ConfirmAction action={() => revokePro(userId)} title="PRO obunani bekor qilasizmi?" description="Foydalanuvchi premium materiallarga kirish huquqini darhol yo‘qotadi." confirmLabel="Bekor qilish" testId="revoke-pro">
            PRO’ni bekor qilish
          </ConfirmAction>
        )}
      </div>
    </div>
  );
}

export function AccountControls({
  userId,
  status,
  role,
  isSelf,
  emailVerified,
}: {
  userId: string;
  status: "ACTIVE" | "SUSPENDED";
  role: "USER" | "SUPER_ADMIN";
  isSelf: boolean;
  emailVerified: boolean;
}) {
  if (isSelf) return <p className="text-sm text-muted-foreground">O‘z hisobingiz holati va rolini bu yerda o‘zgartira olmaysiz.</p>;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {status === "ACTIVE" ? (
          <ConfirmAction action={() => setAccountStatus(userId, "SUSPENDED")} title="Hisobni bloklaysizmi?" description="Foydalanuvchi tizimdan chiqariladi va kira olmaydi." confirmLabel="Bloklash">
            Hisobni bloklash
          </ConfirmAction>
        ) : (
          <ConfirmAction action={() => setAccountStatus(userId, "ACTIVE")} title="Hisobni faollashtirasizmi?" confirmLabel="Faollashtirish" destructive={false}>
            Hisobni faollashtirish
          </ConfirmAction>
        )}
        <ConfirmAction action={() => revokeUserSessions(userId)} title="Barcha sessiyalarni yopasizmi?" description="Foydalanuvchi barcha qurilmalardan chiqariladi." confirmLabel="Yopish">
          Sessiyalarni yopish
        </ConfirmAction>
        {!emailVerified && (
          <ConfirmAction
            action={() => markEmailVerified(userId)}
            title="Emailni qo‘lda tasdiqlaysizmi?"
            description="Faqat manzil shu foydalanuvchiniki ekaniga ishonch hosil qilgan bo‘lsangiz (masalan, Telegram orqali so‘radingiz). Shundan keyin u tasdiqlash xatisiz kira oladi."
            confirmLabel="Tasdiqlash"
            destructive={false}
            testId="mark-email-verified"
          >
            Emailni qo‘lda tasdiqlash
          </ConfirmAction>
        )}
      </div>
      <RoleControls userId={userId} role={role} />
    </div>
  );
}

/** Switch a user between learner and super admin. */
export function RoleControls({ userId, role }: { userId: string; role: "USER" | "SUPER_ADMIN" }) {
  return role === "USER" ? (
    <ConfirmAction
      action={() => setUserRole(userId, "SUPER_ADMIN")}
      title="Super admin qilasizmi?"
      description="Super admin panelga to‘liq kirish beriladi: kontent, foydalanuvchilar, PRO, arizalar va sozlamalar."
      confirmLabel="Super admin qilish"
      destructive={false}
      testId="role-super_admin"
    >
      Super admin qilish
    </ConfirmAction>
  ) : (
    <ConfirmAction
      action={() => setUserRole(userId, "USER")}
      title="Super admin huquqini olasizmi?"
      description="Foydalanuvchi panelga kira olmaydi."
      confirmLabel="Huquqni olish"
      testId="role-user"
    >
      Super admin huquqini olish
    </ConfirmAction>
  );
}
