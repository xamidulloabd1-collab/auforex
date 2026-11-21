"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, SendIcon } from "lucide-react";
import { authClient, authErrorMessage } from "@/lib/auth/client";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormAlert } from "./auth-card";

type Values = { email: string };

export function ForgotPasswordForm() {
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  async function onSubmit(values: Values) {
    setError(null);
    const { error: err } = await authClient.requestPasswordReset({
      email: values.email.trim().toLowerCase(),
      redirectTo: "/reset-password",
    });
    // Same response whether or not the account exists (prevents account enumeration).
    if (err && err.status === 429) {
      setError(authErrorMessage(err));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <FormAlert tone="success">
        Agar bu email bilan hisob mavjud bo‘lsa, parolni tiklash havolasi yuborildi. Pochta qutingizni (va “Spam” jildini) tekshiring. Havola 1 soat amal qiladi.
        <Link href="/login" className="mt-3 block font-semibold text-gold-soft underline-offset-4 hover:underline">
          Kirish sahifasiga qaytish
        </Link>
      </FormAlert>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5" noValidate>
        {error && <FormAlert>{error}</FormAlert>}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="siz@misol.uz" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
          Tiklash havolasini yuborish
        </Button>
        <Link href="/login" className="text-center text-sm text-muted-foreground transition hover:text-foreground">
          Kirish sahifasiga qaytish
        </Link>
      </form>
    </Form>
  );
}
