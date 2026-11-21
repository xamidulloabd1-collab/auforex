import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkEnv } from "@/lib/env";
import { getEnvValue } from "../../scripts/lib/env-file.mjs";

/** Parses .env.example the way dotenv would (KEY="value" lines). */
function loadExample() {
  const text = readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
  const keys = [...text.matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1]!);
  return Object.fromEntries(keys.map((k) => [k, getEnvValue(text, k)]));
}

describe(".env.example works as-is after `npm run setup`", () => {
  it("passes validation once a real secret is set (empty values mean “not set”)", () => {
    const env = { ...loadExample(), BETTER_AUTH_SECRET: "x".repeat(48) };
    const result = checkEnv(env);
    expect(result.ok ? [] : result.issues).toEqual([]);
  });

  it("does not ship a default extra admin that would break the seed", () => {
    expect(loadExample().ADMIN_EMAIL).toBe("");
  });

  it("empty optional values fall back to defaults", () => {
    const result = checkEnv({
      DATABASE_URL: "postgresql://x",
      BETTER_AUTH_SECRET: "x".repeat(48),
      REQUIRE_EMAIL_VERIFICATION: "",
      SMTP_PORT: "",
      BETTER_AUTH_URL: "",
      MAX_VIDEO_UPLOAD_MB: "",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.MAX_VIDEO_UPLOAD_MB).toBe(2048);
      expect(result.data.REQUIRE_EMAIL_VERIFICATION).toBeUndefined();
    }
  });

  it("still reports missing required values clearly", () => {
    const result = checkEnv({ DATABASE_URL: "", BETTER_AUTH_SECRET: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.join(" ")).toMatch(/DATABASE_URL is required[\s\S]*BETTER_AUTH_SECRET is required/);
  });
});
