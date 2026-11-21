import { z } from "zod";
import { nameSchema } from "./auth";

export const profileSchema = z.object({
  name: nameSchema,
  bio: z.string().trim().max(500, "Bio 500 ta belgidan oshmasin"),
  telegram: z
    .string()
    .trim()
    .max(33)
    .refine((v) => v === "" || /^@?[A-Za-z0-9_]{5,32}$/.test(v), "Telegram username noto‘g‘ri (masalan: @username)"),
  experienceLevel: z.enum(["", "BEGINNER", "INTERMEDIATE", "ADVANCED"]),
});

export type ProfileInput = z.infer<typeof profileSchema>;
