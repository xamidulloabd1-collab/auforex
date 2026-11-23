/**
 * Environment schema shared by the app (lib/env.ts) and CLI tools (npm run doctor).
 * No `server-only` import here so scripts can use it.
 */
import { z } from "zod";

const boolish = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string({ error: "DATABASE_URL is required" }).min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z
    .string({ error: "BETTER_AUTH_SECRET is required (run `npm run setup` to generate one)" })
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters (run `npm run setup` to generate one)")
    .refine((v) => process.env.NODE_ENV !== "production" || !v.startsWith("replace-with"), {
      message: "BETTER_AUTH_SECRET still has the example value — set a real random secret",
    }),
  BETTER_AUTH_URL: z.url().optional(),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  TRUSTED_ORIGINS: z.string().optional(),

  STORAGE_DRIVER: z.enum(["local"]).default("local"),
  /** Bunny Stream → Library → Security → "Token authentication key" (signs lesson video links). */
  BUNNY_STREAM_TOKEN_KEY: z.string().min(16, "BUNNY_STREAM_TOKEN_KEY juda qisqa").optional(),
  STORAGE_LOCAL_ROOT: z.string().default("./storage"),
  MAX_VIDEO_UPLOAD_MB: z.coerce.number().int().positive().default(2048),
  MAX_BOOK_UPLOAD_MB: z.coerce.number().int().positive().default(100),
  MAX_IMAGE_UPLOAD_MB: z.coerce.number().int().positive().default(5),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: boolish,
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  /** When SMTP is configured, email verification is required unless this is "false". */
  REQUIRE_EMAIL_VERIFICATION: z.enum(["true", "false"]).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * `KEY=""` in .env means "not set". Treating empty strings as undefined lets every
 * optional variable keep its default instead of failing validation.
 */
export function normalizeEnv(source: NodeJS.ProcessEnv | Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(source).map(([k, v]) => [k, v === "" ? undefined : v]));
}

/** Validates a set of variables; returns readable issues instead of throwing. */
export function checkEnv(source: NodeJS.ProcessEnv | Record<string, string | undefined>) {
  const parsed = serverEnvSchema.safeParse(normalizeEnv(source));
  return parsed.success
    ? ({ ok: true, data: parsed.data } as const)
    : ({ ok: false, issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) } as const);
}

