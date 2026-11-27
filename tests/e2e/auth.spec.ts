import { expect, test, type Page } from "@playwright/test";
import { mailAvailable, registerUser, testAddress } from "./helpers";

/**
 * Sign-in reliability. The production bug: Better Auth checks the Origin header whenever the
 * browser sends any cookie; with the site address not configured it trusted only
 * http://localhost:3000, so returning visitors got 403 → "Amalni bajarib bo‘lmadi".
 */
const RUN = Date.now().toString(36);
const PASSWORD = "Trader2026x";
const EMAIL = testAddress(`auth-${RUN}`);

async function signIn(page: Page, id: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email yoki login").fill(id);
  await page.getByLabel("Parol", { exact: true }).fill(password);
  await page.getByTestId("login-form").getByRole("button", { name: "Kirish" }).click();
}

test.describe.serial("Authentication", () => {
  test("register while a cookie is already set, session survives reload", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "theme", value: "dark", url: baseURL! }]);
    await registerUser(page, { name: "Auth Tester", email: EMAIL, password: PASSWORD });
    // Session survives a reload.
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("Auth Tester").first()).toBeVisible();
  });

  test("sign in again with cookies present (the production failure), wrong password rejected", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "theme", value: "dark", url: baseURL! }]);
    await signIn(page, EMAIL, "Wrong-password-1");
    await expect(page.getByText("Email yoki parol noto‘g‘ri")).toBeVisible();
    await signIn(page, EMAIL, PASSWORD);
    await page.waitForURL("**/dashboard");
    // A second request carrying the session cookie also passes the origin check.
    const res = await page.request.post("/api/auth/sign-out", { headers: { origin: new URL(baseURL!).origin }, data: {} });
    expect(res.status()).toBe(200);
    await page.goto("/dashboard");
    await page.waitForURL("**/login**");
  });

  test("cross-site requests stay rejected", async ({ context, baseURL }) => {
    // The cookie goes into the jar, not a raw `cookie` header: a raw header would replace the jar
    // (and with it the Vercel protection cookie a deployed Preview needs), so the 401 would come from Vercel.
    await context.addCookies([{ name: "theme", value: "dark", url: baseURL! }]);
    const res = await context.request.post("/api/auth/sign-in/email", {
      headers: { origin: "https://evil.example" },
      data: { email: EMAIL, password: PASSWORD },
    });
    expect(res.status()).toBe(403);
    expect(new URL(baseURL!).origin).not.toBe("https://evil.example");
  });

  test("protected pages and admin area", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login**");
    await page.goto("/super-admin");
    await page.waitForURL("**/login**");
    await signIn(page, EMAIL, PASSWORD);
    await page.waitForURL("**/dashboard");
    // Non-admins get a 404 — the admin area is not even acknowledged.
    await page.goto("/super-admin");
    await expect(page.getByRole("heading", { name: "Sahifa topilmadi" })).toBeVisible();
    await expect(page.getByText("Super Admin").first()).toHaveCount(0);
    const api = await page.request.post("/api/admin/uploads", { data: { action: "init", kind: "video", size: 10, name: "a.mp4", type: "video/mp4" } });
    expect([401, 403]).toContain(api.status());
  });

  test("password reset page: the form with a mail service, a clear notice without one", async ({ page }) => {
    await page.goto("/forgot-password");
    if (mailAvailable) {
      await expect(page.getByRole("button", { name: "Tiklash havolasini yuborish" })).toBeVisible();
    } else {
      await expect(page.getByTestId("password-reset-unavailable")).toContainText("vaqtincha mavjud emas");
      await expect(page.getByRole("button", { name: "Tiklash havolasini yuborish" })).toHaveCount(0);
    }
  });

  test("sign in on a phone", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.addCookies([{ name: "theme", value: "dark", url: baseURL! }]);
    const page = await ctx.newPage();
    await signIn(page, EMAIL, PASSWORD);
    await page.waitForURL("**/dashboard");
    await ctx.close();
  });
});
