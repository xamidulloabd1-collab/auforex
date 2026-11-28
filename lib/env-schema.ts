/**
 * Environment schema shared by the app (lib/env.ts) and CLI tools (npm run doctor).
 * No `server-only` import here so scripts can use it.
 */
import { z } from "zod";

/** "true"/"1" → true, "false"/"0" → false, not set → undefined (so a default can apply). */
const boolish = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : v === "true" || v === "1"));

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

  /** "s3" = Cloudflare R2 / AWS S3 / any S3-compatible bucket (needed on Vercel); "local" = disk. Default: s3 when S3_* are set. */
  STORAGE_DRIVER: z.enum(["local", "s3"]).optional(),
  S3_ENDPOINT: z.url({ error: "S3_ENDPOINT to‘liq manzil bo‘lsin (https://…)" }).optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().min(3).optional(),
  S3_ACCESS_KEY_ID: z.string().min(8).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(16).optional(),
  /** Only for temporary S3 credentials (e.g. R2 Temporary Credentials API on a Preview). */
  S3_SESSION_TOKEN: z.string().min(16).optional(),
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
  /** Verification defaults on when SMTP is configured and in production; "false" explicitly disables it. */
  REQUIRE_EMAIL_VERIFICATION: z.enum(["true", "false"]).optional(),
});

export const serverEnvSchemaChecked = serverEnvSchema.superRefine((e, ctx) => {
  const s3 = [e.S3_ENDPOINT, e.S3_BUCKET, e.S3_ACCESS_KEY_ID, e.S3_SECRET_ACCESS_KEY];
  const partial = s3.some(Boolean) && !s3.every(Boolean);
  if (partial || (e.STORAGE_DRIVER === "s3" && !s3.every(Boolean))) {
    ctx.addIssue({
      code: "custom",
      path: ["S3_ENDPOINT"],
      message: "S3 sozlamalari to‘liq emas: S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY hammasi kerak",
    });
  }

  const mailTransportSettings = [e.SMTP_HOST, e.SMTP_USER, e.SMTP_PASSWORD];
  if (mailTransportSettings.some(Boolean) && (!e.SMTP_HOST || !e.MAIL_FROM)) {
    ctx.addIssue({
      code: "custom",
      path: ["SMTP_HOST"],
      message: "Email uchun SMTP_HOST va MAIL_FROM ikkalasi ham kerak",
    });
  }
  if (Boolean(e.SMTP_USER) !== Boolean(e.SMTP_PASSWORD)) {
    ctx.addIssue({
      code: "custom",
      path: ["SMTP_USER"],
      message: "SMTP autentifikatsiyasi uchun SMTP_USER va SMTP_PASSWORD ikkalasi ham kerak",
    });
  }
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function emailVerificationRequired(
  environment: Pick<ServerEnv, "NODE_ENV" | "REQUIRE_EMAIL_VERIFICATION">,
  mailConfigured: boolean,
) {
  if (environment.REQUIRE_EMAIL_VERIFICATION === "false") return false;
  if (environment.REQUIRE_EMAIL_VERIFICATION === "true") return true;
  return mailConfigured || environment.NODE_ENV === "production";
}

/**
 * `KEY=""` in .env means "not set". Treating empty strings as undefined lets every
 * optional variable keep its default instead of failing validation.
 */
export function normalizeEnv(source: NodeJS.ProcessEnv | Record<string, string | undefined>) {
  const out: Record<string, string | undefined> = Object.fromEntries(
    Object.entries(source).map(([k, v]) => [k, v === "" ? undefined : v]),
  );
  // No site address configured: use the one the host provides instead of http://localhost:3000.
  if (!out.NEXT_PUBLIC_APP_URL) {
    const host = vercelSiteHost(out) ?? out.RAILWAY_PUBLIC_DOMAIN;
    if (host) out.NEXT_PUBLIC_APP_URL = `https://${host}`;
  }
  return out;
}

/** Vercel system variables: the production domain in production, the deployment URL otherwise. */
export function vercelSiteHost(source: Record<string, string | undefined>) {
  if (source.VERCEL !== "1") return undefined;
  if (source.VERCEL_ENV === "production" && source.VERCEL_PROJECT_PRODUCTION_URL) return source.VERCEL_PROJECT_PRODUCTION_URL;
  return source.VERCEL_BRANCH_URL || source.VERCEL_URL || source.VERCEL_PROJECT_PRODUCTION_URL || undefined;
}

/** This project's own Vercel domains (production, branch, deployment) — trusted for sign-in. */
export function vercelOrigins(source: Record<string, string | undefined>) {
  if (source.VERCEL !== "1") return [];
  return [source.VERCEL_PROJECT_PRODUCTION_URL, source.VERCEL_BRANCH_URL, source.VERCEL_URL]
    .filter((h): h is string => Boolean(h))
    .map((h) => `https://${h}`);
}

/** Validates a set of variables; returns readable issues instead of throwing. */
export function checkEnv(source: NodeJS.ProcessEnv | Record<string, string | undefined>) {
  const parsed = serverEnvSchemaChecked.safeParse(normalizeEnv(source));
  return parsed.success
    ? ({ ok: true, data: parsed.data } as const)
    : ({ ok: false, issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) } as const);
}

