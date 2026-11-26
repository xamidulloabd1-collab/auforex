"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CameraIcon, KeyRoundIcon, Loader2Icon, LogOutIcon, MailIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { authClient, authErrorMessage } from "@/lib/auth/client";
import { changeEmail, removeAvatar, updateProfile } from "@/lib/actions/profile";
import { changePasswordSchema } from "@/lib/validations/auth";
import { profileSchema, type ProfileInput } from "@/lib/validations/profile";
import { initials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PasswordInput } from "@/components/auth/password-input";
import { MAX_SINGLE_REQUEST_IMAGE_BYTES as MAX_IMAGE_BYTES } from "@/lib/constants";

export function SettingsCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card-surface p-6 sm:p-7">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function AvatarForm({ name, image }: { name: string; image: string | null }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState(false);

  async function upload(file: File) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Faqat PNG, JPG yoki WEBP rasm yuklang");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Rasm hajmi 4 MB dan oshmasin");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/account/avatar", { method: "POST", body: file, headers: { "Content-Type": file.type } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Yuklab bo‘lmadi");
      toast.success("Avatar yangilandi");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      <Avatar className="size-20">
        {image && <AvatarImage src={image} alt="" />}
        <AvatarFallback className="text-lg">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-wrap gap-2">
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id="avatar-input" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <Button variant="secondary" disabled={pending} onClick={() => inputRef.current?.click()}>
          {pending ? <Loader2Icon className="animate-spin" /> : <CameraIcon />} Rasm yuklash
        </Button>
        {image && (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={async () => {
              const res = await removeAvatar();
              if (res.ok) router.refresh();
              else toast.error(res.error);
            }}
          >
            <Trash2Icon /> O‘chirish
          </Button>
        )}
      </div>
      <p className="w-full text-xs text-muted-foreground">PNG, JPG yoki WEBP, 4 MB gacha.</p>
    </div>
  );
}

export function ProfileForm({ defaults }: { defaults: ProfileInput }) {
  const router = useRouter();
  const form = useForm<ProfileInput>({ resolver: zodResolver(profileSchema), defaultValues: defaults });

  async function onSubmit(values: ProfileInput) {
    const res = await updateProfile(values);
    if (res.ok) {
      toast.success(res.message ?? "Saqlandi");
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5" data-testid="profile-form">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ism va familiya</FormLabel>
              <FormControl>
                <Input autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="telegram"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telegram</FormLabel>
                <FormControl>
                  <Input placeholder="@username" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="experienceLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tajriba darajasi</FormLabel>
                <FormControl>
                  <NativeSelect {...field}>
                    <option value="">Ko‘rsatilmagan</option>
                    <option value="BEGINNER">Boshlovchi</option>
                    <option value="INTERMEDIATE">O‘rta</option>
                    <option value="ADVANCED">Tajribali</option>
                  </NativeSelect>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>O‘zingiz haqingizda</FormLabel>
              <FormControl>
                <Textarea rows={4} maxLength={500} placeholder="Maqsadlaringiz, qiziqishlaringiz…" {...field} />
              </FormControl>
              <FormDescription>500 ta belgigacha.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Saqlash
          </Button>
        </div>
      </form>
    </Form>
  );
}

type PwValues = { currentPassword: string; newPassword: string; confirmPassword: string; revokeOtherSessions: boolean };

export function ChangePasswordForm() {
  const form = useForm<PwValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "", revokeOtherSessions: true },
  });

  async function onSubmit(v: PwValues) {
    const { error } = await authClient.changePassword({
      currentPassword: v.currentPassword,
      newPassword: v.newPassword,
      revokeOtherSessions: v.revokeOtherSessions,
    });
    if (error) {
      toast.error(authErrorMessage(error));
      return;
    }
    toast.success("Parol o‘zgartirildi");
    form.reset();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5" data-testid="password-form">
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Joriy parol</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Yangi parol</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Yangi parolni tasdiqlang</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="revokeOtherSessions"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-3">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              </FormControl>
              <FormLabel className="font-normal text-muted-foreground">Boshqa qurilmalardagi sessiyalarni yopish</FormLabel>
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : <KeyRoundIcon />} Parolni o‘zgartirish
          </Button>
        </div>
      </form>
    </Form>
  );
}

export function AccountActions({
  email,
  username,
  emailVerified,
  canResend,
}: {
  email: string;
  username: string | null;
  emailVerified: boolean;
  canResend: boolean;
}) {
  const [busy, setBusy] = React.useState<string | null>(null);

  return (
    <div className="grid gap-4">
      {username && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Kirish uchun login: <span className="font-mono font-semibold text-foreground" data-testid="my-username">{username}</span>
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-3">
          <MailIcon className="size-4 text-muted-foreground" />
          <span className="text-sm">{email}</span>
          <span className={emailVerified ? "text-xs text-success" : "text-xs text-amber-300"}>{emailVerified ? "Tasdiqlangan" : "Tasdiqlanmagan"}</span>
        </div>
        {!emailVerified && canResend && (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy === "verify"}
            onClick={async () => {
              setBusy("verify");
              const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/verify-email" });
              setBusy(null);
              if (error) toast.error(authErrorMessage(error));
              else toast.success("Tasdiqlash xati yuborildi");
            }}
          >
            Tasdiqlash xatini yuborish
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <p className="text-sm text-muted-foreground">Boshqa barcha qurilmalardagi kirishlarni yopish</p>
        <Button
          size="sm"
          variant="outline"
          disabled={busy === "revoke"}
          onClick={async () => {
            setBusy("revoke");
            const { error } = await authClient.revokeOtherSessions();
            setBusy(null);
            if (error) toast.error(authErrorMessage(error));
            else toast.success("Boshqa sessiyalar yopildi");
          }}
        >
          <LogOutIcon /> Barchasidan chiqish
        </Button>
      </div>
    </div>
  );
}

export function ChangeEmailForm() {
  const router = useRouter();
  const [newEmail, setNewEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  return (
    <form
      className="grid gap-4"
      data-testid="change-email-form"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await changeEmail({ newEmail, currentPassword: password });
          if (res.ok) {
            toast.success(res.message ?? "Saqlandi");
            setNewEmail("");
            setPassword("");
            router.refresh();
          } else toast.error(res.error);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor="new-email" className="text-sm font-medium">Yangi email</label>
          <Input id="new-email" type="email" autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <label htmlFor="email-password" className="text-sm font-medium">Joriy parol</label>
          <PasswordInput id="email-password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" disabled={pending || !newEmail || !password}>
          {pending ? <Loader2Icon className="animate-spin" /> : <MailIcon />} Emailni o‘zgartirish
        </Button>
      </div>
    </form>
  );
}
