import "server-only";
import { checkEnv, type ServerEnv } from "./env-schema";

export { checkEnv, normalizeEnv, type ServerEnv } from "./env-schema";

let cached: ServerEnv | null = null;

/** Validates environment variables lazily (so `next build` works without secrets). */
export function env(): ServerEnv {
  if (cached) return cached;
  const result = checkEnv(process.env);
  if (!result.ok) {
    const issues = result.issues.map((i) => `  • ${i}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}\nSee .env.example (or run \`npm run doctor\`)`);
  }
  cached = result.data;
  return cached;
}

export function isMailConfigured() {
  const e = env();
  return Boolean(e.SMTP_HOST && e.MAIL_FROM);
}

export function appUrl() {
  const e = env();
  return (e.BETTER_AUTH_URL ?? e.NEXT_PUBLIC_APP_URL).replace(/\/$/, "");
}
