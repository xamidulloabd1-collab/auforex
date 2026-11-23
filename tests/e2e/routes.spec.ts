import { expect, test, type Page } from "@playwright/test";

/**
 * Route QA: every page opens without a server error, guests are sent to sign-in where needed,
 * admins reach every Super admin page (including detail pages), and key pages fit a phone screen.
 */
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@auforex.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe-Admin-2026!";

const PUBLIC = ["/", "/books", "/lessons", "/challenge", "/founder", "/subscription", "/tradingview", "/login", "/register", "/forgot-password"];
const PROTECTED = ["/dashboard", "/dashboard/learning", "/dashboard/books", "/dashboard/challenges", "/dashboard/settings", "/dashboard/subscription"];
const ADMIN = [
  "/super-admin",
  "/super-admin/users",
  "/super-admin/requests",
  "/super-admin/courses",
  "/super-admin/categories",
  "/super-admin/lessons",
  "/super-admin/lessons/new",
  "/super-admin/books",
  "/super-admin/books/new",
  "/super-admin/challenges",
  "/super-admin/challenges/new",
  "/super-admin/founder",
  "/super-admin/settings",
  "/super-admin/team",
  "/super-admin/audit",
];

/** Opens a page and fails on HTTP errors, the error boundary, the 404 page or uncaught page errors. */
async function visit(page: Page, path: string) {
  const errors: string[] = [];
  const onError = (e: Error) => errors.push(e.message);
  page.on("pageerror", onError);
  const res = await page.goto(path);
  expect(res?.status(), `${path} status`).toBeLessThan(400);
  await expect(page.locator("body")).not.toContainText("Application error");
  await expect(page.getByRole("heading", { name: "Sahifa topilmadi" }), `${path} is not 404`).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 }).first(), `${path} has a heading`).toBeVisible();
  page.off("pageerror", onError);
  expect(errors, `${path} page errors`).toEqual([]);
}

async function firstHref(page: Page, listPath: string, pattern: RegExp) {
  await page.goto(listPath);
  const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  return hrefs.find((h) => pattern.test(h)) ?? null;
}

test.describe("Routes", () => {
  test("public pages open for guests", async ({ page }) => {
    for (const path of PUBLIC) await visit(page, path);
    for (const [list, pattern] of [
      ["/books", /^\/books\/[^/?#]+$/],
      ["/challenge", /^\/challenge\/[^/?#]+$/],
    ] as const) {
      const href = await firstHref(page, list, pattern);
      if (href) await visit(page, href);
    }
  });

  test("account pages send guests to sign-in", async ({ page }) => {
    for (const path of PROTECTED) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/login/);
    }
  });

  test("admin reaches every Super admin page, including detail pages", async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto("/login");
    await page.getByLabel("Email yoki login").fill(ADMIN_EMAIL);
    await page.getByLabel("Parol", { exact: true }).fill(ADMIN_PASSWORD);
    await page.getByTestId("login-form").getByRole("button", { name: "Kirish" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));

    for (const path of [...ADMIN, ...PROTECTED]) await visit(page, path);
    for (const [list, pattern] of [
      ["/super-admin/users", /^\/super-admin\/users\/[^/]+$/],
      ["/super-admin/books", /^\/super-admin\/books\/(?!new)[^/]+$/],
      ["/super-admin/lessons", /^\/super-admin\/lessons\/(?!new)[^/?]+$/],
      ["/super-admin/challenges", /^\/super-admin\/challenges\/(?!new)[^/]+$/],
      ["/super-admin/challenges", /^\/super-admin\/challenges\/[^/]+\/submissions$/],
      ["/lessons", /^\/lessons\/[^/?#]+$/],
      ["/books", /^\/books\/[^/?#]+$/],
    ] as const) {
      const href = await firstHref(page, list, pattern);
      if (href) await visit(page, href);
    }
  });

  test("key pages fit a phone screen", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    for (const path of ["/", "/lessons", "/books", "/founder", "/subscription", "/login", "/register"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} horizontal overflow (px)`).toBeLessThanOrEqual(1);
    }
    await ctx.close();
  });
});
