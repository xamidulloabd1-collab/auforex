"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRoundIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { authClient, authErrorMessage } from "@/lib/auth/client";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormAlert } from "./auth-card";
import { PasswordInput } from "./password-input";

type Values = { password: string; confirmPassword: string };

export function ResetPasswordForm({ token, invalid }: { token: string | null; invalid: boolean }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: "", confirmPassword: "" } });

  if (!token || invalid) {
    return (
      <FormAlert>
        Havola yaroqsiz yoki muddati tugagan. Yangi havola so‘rang.
        <Link href="/forgot-password" className="mt-3 block font-semibold text-gold-soft underline-offset-4 hover:underline">
          Yangi havola so‘rash
        </Link>
      </FormAlert>
    );
  }

  async function onSubmit(values: Values) {
    setError(null);
    const { error: err } = await authClient.resetPassword({ newPassword: values.password, token: token! });
    if (err) {
      setError(authErrorMessage(err));
      return;
    }
    toast.success("Parol yangilandi. Yangi parol bilan kiring.");
    router.push("/login");
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5" noValidate>
        {error && <FormAlert>{error}</FormAlert>}
        <FormField
          control={form.control}
          name="password"
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
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : <KeyRoundIcon />}
          Parolni yangilash
        </Button>
      </form>
    </Form>
  );
}
