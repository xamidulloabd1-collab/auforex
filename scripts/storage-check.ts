/**
 * Checks the Cloudflare R2 / S3 bucket with the keys from .env (or the shell):
 *   npm run storage:check
 *   npm run storage:check -- --origin https://auforex.vercel.app   (the site address to test CORS for)
 *
 * Writes, reads and deletes a tiny test object under _healthcheck/, tests the browser upload
 * rules (CORS preflight, ETag) and a multipart start/cancel. Keys are never printed.
 */
import { loadProjectEnv } from "./lib/env-load.mjs";
import { isR2Endpoint, parseS3Config } from "../lib/storage/config";
import { probeStorage } from "../lib/storage/probe";

loadProjectEnv(process.cwd(), process.env.NODE_ENV === "production" ? "production" : "development");

const arg = process.argv.indexOf("--origin");
const rawOrigin = (arg > -1 ? process.argv[arg + 1] : undefined) ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

async function main() {
  let origin: string;
  try {
    origin = new URL(rawOrigin).origin;
  } catch {
    console.error(`✗ Sayt manzili noto‘g‘ri: ${rawOrigin}`);
    process.exit(1);
  }

  const parsed = parseS3Config(process.env);
  if (!parsed.ok) {
    console.error(`✗ ${parsed.error}`);
    process.exit(1);
  }
  if (!parsed.config) {
    console.error("✗ S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY to‘liq kiritilmagan (docs/FAYL-SAQLASH.md).");
    process.exit(1);
  }

  const { endpoint, bucket } = parsed.config;
  console.log(`\nFayl ombori: ${new URL(endpoint).host} · bucket “${bucket}”${isR2Endpoint(endpoint) ? " (Cloudflare R2)" : ""}`);
  console.log(`CORS tekshiriladigan sayt: ${origin}\n`);

  const steps = await probeStorage(parsed.config, origin);
  for (const s of steps) {
    console.log(`${s.ok ? "✓" : "✗"} ${s.name}`);
    if (s.detail) console.log(`    → ${s.detail}`);
  }
  const failed = steps.filter((s) => !s.ok).length;
  if (failed) {
    console.log("\nCORS namunasi va qadamlar: docs/FAYL-SAQLASH.md (3-bo‘lim).");
    process.exit(1);
  }
  console.log("\nHammasi joyida: yuklash va o‘qish ishlaydi.");
}

void main();
