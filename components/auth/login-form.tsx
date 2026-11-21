"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, LogInIcon } from "lucide-react";
import { toast } from "sonner";
import { authClient, authErrorMessage } from "@/lib/auth/client";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { safeRedirectPath } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormAlert } from "./auth-card";
import { PasswordInput } from "./password-input";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeRedirectPath(params.get("next"));
  const [error, setError] = React.useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = React.useState<string | null>(null);
  const [resending, setResending] = React.useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: true },
  });

  async function onSubmit(values: LoginInput) {
    setError(null);
    setUnverifiedEmail(null);
    const identifier = values.email.trim().toLowerCase();
    const isEmail = identifier.includes("@");
    const { error: err } = isEmail
      ? await authClient.signIn.email({ email: identifier, password: values.password, rememberMe: values.rememberMe })
      : await authClient.signIn.username({ username: identifier, password: values.password, rememberMe: values.rememberMe });
    if (err) {
      if (err.code === "EMAIL_NOT_VERIFIED" && isEmail) setUnverifiedEmail(identifier);
      setError(authErrorMessage(err));
      return;
    }
    toast.success("Xush kelibsiz!");
    router.push(next);
    router.refresh();
  }

  async function resendVerification() {
    if (!unverifiedEmail) return;
    setResending(true);
    const { error: err } = await authClient.sendVerificationEmail({ email: unverifiedEmail, callbackURL: "/verify-email" });
    setResending(false);
    if (err) toast.error(authErrorMessage(err));
    else toast.success("Tasdiqlash xati qayta yuborildi");
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5" noValidate data-testid="login-form">
        {error && (
          <FormAlert>
            {error}
            {unverifiedEmail && (
              <button type="button" onClick={resendVerification} disabled={resending} className="mt-2 block font-semibold text-gold-soft underline-offset-4 hover:underline">
                {resending ? "Yuborilmoqda…" : "Tasdiqlash xatini qayta yuborish"}
              </button>
            )}
          </FormAlert>
        )}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email yoki login</FormLabel>
              <FormControl>
                <Input type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="siz@misol.uz" {...field} />
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
              <div className="flex items-center justify-between">
                <FormLabel>Parol</FormLabel>
                <Link href="/forgot-password" className="text-xs font-medium text-gold-soft underline-offset-4 hover:underline">
                  Parolni unutdingizmi?
                </Link>
              </div>
              <FormControl>
                <PasswordInput autoComplete="current-password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="rememberMe"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-3">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              </FormControl>
              <FormLabel className="font-normal text-muted-foreground">Meni eslab qol</FormLabel>
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting} className="mt-1">
          {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : <LogInIcon />}
          Kirish
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Hisobingiz yo‘qmi?{" "}
          <Link href={`/register${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-gold-soft underline-offset-4 hover:underline">
            Ro‘yxatdan o‘ting
          </Link>
        </p>
      </form>
    </Form>
  );
}
