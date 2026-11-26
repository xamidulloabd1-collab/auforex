"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, MailCheckIcon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";
import { authClient, authErrorMessage } from "@/lib/auth/client";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { safeRedirectPath } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormAlert } from "./auth-card";
import { PasswordInput } from "./password-input";

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeRedirectPath(params.get("next"));
  const [error, setError] = React.useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = React.useState<string | null>(null);
  const [verificationSent, setVerificationSent] = React.useState(false);
  const [verificationError, setVerificationError] = React.useState<string | null>(null);
  const [resending, setResending] = React.useState(false);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "", acceptTerms: false },
  });

  async function sendVerification(email: string) {
    setResending(true);
    setVerificationError(null);
    const { error: sendError } = await authClient.sendVerificationEmail({ email, callbackURL: "/verify-email" });
    setResending(false);
    if (sendError) {
      setVerificationSent(false);
      setVerificationError(authErrorMessage(sendError));
      return;
    }
    setVerificationSent(true);
  }

  async function onSubmit(values: RegisterInput) {
    setError(null);
    const email = values.email.trim().toLowerCase();
    const { data, error: err } = await authClient.signUp.email({
      name: values.name.trim(),
      email,
      password: values.password,
      callbackURL: "/verify-email",
    });
    if (err) {
      setError(authErrorMessage(err));
      return;
    }
    if (!data?.token) {
      setPendingEmail(email);
      await sendVerification(email);
      return;
    }
    toast.success("Hisobingiz yaratildi. Xush kelibsiz!");
    router.push(next);
    router.refresh();
  }

  if (pendingEmail) {
    return (
      <div className="card-surface p-6 text-center" data-testid="verify-email-notice">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl border border-success/30 bg-success/10">
          <MailCheckIcon className="size-6 text-success" />
        </div>
        <h2 className="font-display text-xl font-bold">Emailingizni tekshiring</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground" role={verificationError ? "alert" : undefined}>
          {verificationError ? (
            <>Hisob yaratildi, ammo tasdiqlash xati yuborilmadi: {verificationError}</>
          ) : verificationSent ? (
            <>
              <span className="font-medium text-foreground">{pendingEmail}</span> manziliga tasdiqlash havolasi yuborildi. Havolani bosganingizdan so‘ng hisobingiz faollashadi.
            </>
          ) : (
            <>Tasdiqlash xati yuborilmadi. Qayta urinib ko‘ring.</>
          )}
        </p>
        <Button type="button" variant="secondary" className="mt-4 w-full" disabled={resending} onClick={() => sendVerification(pendingEmail)}>
          {resending ? <Loader2Icon className="animate-spin" /> : <MailCheckIcon />}
          {verificationSent ? "Tasdiqlash xatini qayta yuborish" : "Tasdiqlash xatini yuborish"}
        </Button>
        <Button asChild variant="secondary" className="mt-6 w-full">
          <Link href="/login">Kirish sahifasiga o‘tish</Link>
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5" noValidate data-testid="register-form">
        {error && <FormAlert>{error}</FormAlert>}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ism va familiya</FormLabel>
              <FormControl>
                <Input autoComplete="name" placeholder="Ism Familiya" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" inputMode="email" placeholder="siz@misol.uz" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Parol</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" placeholder="Kamida 8 ta belgi" {...field} />
              </FormControl>
              <FormDescription>Kamida 8 ta belgi, harf va raqam bo‘lsin.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Parolni tasdiqlang</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" placeholder="Parolni qayta kiriting" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="acceptTerms"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-start gap-3">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} className="mt-0.5" />
                </FormControl>
                <FormLabel className="block leading-relaxed font-normal text-muted-foreground">
                  Tradingda risk borligini va platforma materiallari investitsiya maslahati emasligini tushunaman.
                </FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting} className="mt-1">
          {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : <UserPlusIcon />}
          Ro‘yxatdan o‘tish
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Hisobingiz bormi?{" "}
          <Link href="/login" className="font-semibold text-gold-soft underline-offset-4 hover:underline">
            Kirish
          </Link>
        </p>
      </form>
    </Form>
  );
}
