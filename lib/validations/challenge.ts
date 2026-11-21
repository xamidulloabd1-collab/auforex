import { z } from "zod";

export const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\/[^\s<>"]+$/.test(v), "Havola https:// bilan boshlanishi kerak");

export const submissionTextSchema = z.object({
  content: z.string().trim().min(30, "Javob kamida 30 ta belgidan iborat bo‘lsin").max(10_000, "Javob juda uzun"),
  linkUrl: httpsUrl.optional().default(""),
});

export const quizAnswersSchema = z.record(z.string().min(1).max(40), z.number().int().min(0).max(20));
