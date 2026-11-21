import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Parol kamida 8 ta belgidan iborat bo‘lsin")
  .max(128, "Parol juda uzun")
  .regex(/[A-Za-z]/, "Parolda kamida bitta harf bo‘lsin")
  .regex(/[0-9]/, "Parolda kamida bitta raqam bo‘lsin");

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email kiriting")
  .max(254, "Email juda uzun")
  .pipe(z.email("Email manzil noto‘g‘ri"))
  .transform((v) => v.toLowerCase());

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Ism kamida 2 ta belgidan iborat bo‘lsin")
  .max(60, "Ism 60 ta belgidan oshmasin")
  .regex(/^[^<>{}$\\]+$/, "Ismda ruxsat etilmagan belgilar bor");

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((v) => v, "Davom etish uchun shartlarga rozilik bildiring"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Parollar mos kelmadi",
  });

/** Sign-in identifier: an email address or an academy-assigned login. */
export const identifierSchema = z
  .string()
  .trim()
  .min(1, "Email yoki loginni kiriting")
  .max(254)
  .refine((v) => (v.includes("@") ? z.email().safeParse(v).success : /^[A-Za-z0-9_.]{3,30}$/.test(v)), "Email yoki login noto‘g‘ri")
  .transform((v) => v.toLowerCase());

export const loginSchema = z.object({
  email: identifierSchema,
  password: z.string().min(1, "Parolni kiriting").max(128),
  rememberMe: z.boolean(),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Parollar mos kelmadi",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Joriy parolni kiriting"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
    revokeOtherSessions: z.boolean(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Parollar mos kelmadi",
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ["newPassword"],
    message: "Yangi parol joriy paroldan farq qilsin",
  });

export type RegisterInput = z.input<typeof registerSchema>;
export type LoginInput = z.input<typeof loginSchema>;
