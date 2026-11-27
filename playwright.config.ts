import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a running server (`npm run build && npm start`).
 *   E2E_BASE_URL       — default http://localhost:3000
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD — an existing admin (e.g. the seeded one)
 *   PLAYWRIGHT_CHROME_PATH — optional system Chrome/Chromium executable
 */
const executablePath = process.env.PLAYWRIGHT_CHROME_PATH;
/**
 * Testing a Vercel Preview protected by Vercel Authentication: Vercel's "Protection Bypass for
 * Automation" secret (Project → Settings → Deployment Protection), sent as its documented headers.
 * Never commit the value; pass it only through the environment of the test run.
 */
const vercelBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: executablePath ? { executablePath, args: ["--no-sandbox"] } : undefined,
    extraHTTPHeaders: vercelBypass ? { "x-vercel-protection-bypass": vercelBypass, "x-vercel-set-bypass-cookie": "true" } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
