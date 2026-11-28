import { expect, test } from "@playwright/test";
import { countMails, linkIn, mailAvailable, nextMail, RESET_SUBJECT, signIn, testAddress, VERIFY_SUBJECT } from "./helpers";

/**
 * Email flows against a real mail service: registration with verification, resending the
 * verification email, password reset (old sessions closed) and changing the email address.
 *
 * Needs a mail source (tests/e2e/helpers.ts): E2E_MAILBOX_DIR (local test SMTP server saving .eml
 * files) or E2E_RESEND=1 (deployed Preview with Resend; Resend test addresses only).
 * Email verification must be on (the default in production when SMTP is configured).
 */
const RUN = Date.now().toString(36);
const PASSWORD = "Trader2026x";
const NEW_PASSWORD = "Trader2027y";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@auforex.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe-Admin-2026!";

test.skip(!mailAvailable, "No mail source: set E2E_MAILBOX_DIR or E2E_RESEND=1");

async function fillRegistration(page: import("@playwright/test").Page, name: string, email: string) {
  await page.goto("/register");
  await page.getByLabel("Ism va familiya").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Parol", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Parolni tasdiqlang").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Ro‘yxatdan o‘tish" }).click();
}

async function tryLogin(page: import("@playwright/test").Page, id: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email yoki login").fill(id);
  await page.getByLabel("Parol", { exact: true }).fill(password);
  await page.getByTestId("login-form").getByRole("button", { name: "Kirish" }).click();
}

test.describe.serial("Email: verification and password reset", () => {
  const email = testAddress(`mail-${RUN}`);

  test("registration sends a verification email; the link verifies and signs in", async ({ page, baseURL }) => {
    await fillRegistration(page, "Mail Tester", email);
    await expect(page.getByTestId("verify-email-notice")).toContainText(email);
    await expect(page.getByTestId("verify-email-notice")).toContainText("tasdiqlash havolasi yuborildi");

    // Not verified yet: sign-in is refused with a resend option.
    await tryLogin(page, email, PASSWORD);
    await expect(page.getByText("Email manzilingiz hali tasdiqlanmagan")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tasdiqlash xatini qayta yuborish" })).toBeVisible();

    const mail = await nextMail(email, VERIFY_SUBJECT);
    expect(mail.text).toContain("Mail Tester");
    const link = linkIn(mail);
    // Links point at the configured site address, never at another host.
    expect(new URL(link).origin).toBe(new URL(baseURL!).origin);

    await page.goto(link);
    await page.waitForURL("**/verify-email**");
    await expect(page.getByRole("heading", { name: "Email tasdiqlandi" })).toBeVisible();
    await page.getByRole("link", { name: "Shaxsiy kabinetga o‘tish" }).click();
    await page.waitForURL("**/dashboard");

    // A forged token is rejected.
    await page.goto(`/api/auth/verify-email?token=forged.${RUN}&callbackURL=%2Fverify-email`);
    await expect(page.getByRole("heading", { name: "Havola yaroqsiz" })).toBeVisible();
  });

  test("an unverified account can request the verification email again", async ({ page }) => {
    const other = testAddress(`mail2-${RUN}`);
    await fillRegistration(page, "Second Tester", other);
    await expect(page.getByTestId("verify-email-notice")).toBeVisible();
    await nextMail(other, VERIFY_SUBJECT);
    const before = await countMails(other, VERIFY_SUBJECT);

    await tryLogin(page, other, PASSWORD);
    await page.getByRole("button", { name: "Tasdiqlash xatini qayta yuborish" }).click();
    await expect(page.getByText("Tasdiqlash xati qayta yuborildi")).toBeVisible();
    await nextMail(other, VERIFY_SUBJECT, before);
  });

  test("Super admin confirms an email by hand (accounts from before verification); the user then signs in", async ({ page, browser }) => {
    const legacy = testAddress(`mail3-${RUN}`);
    await fillRegistration(page, "Legacy Tester", legacy);
    await expect(page.getByTestId("verify-email-notice")).toBeVisible();
    await tryLogin(page, legacy, PASSWORD);
    await expect(page.getByText("Email manzilingiz hali tasdiqlanmagan")).toBeVisible();

    const adminCtx = await browser.newContext();
    const admin = await adminCtx.newPage();
    await signIn(admin, ADMIN_EMAIL, ADMIN_PASSWORD);
    await admin.waitForURL((u) => !u.pathname.startsWith("/login"));
    await admin.goto(`/super-admin/users?q=${encodeURIComponent(legacy)}`);
    await admin.getByTestId("admin-user-row").first().click();
    await expect(admin.getByTestId("admin-email-status")).toHaveText("Tasdiqlanmagan");
    await admin.getByTestId("mark-email-verified").click();
    await admin.getByTestId("mark-email-verified-confirm").click();
    await expect(admin.getByTestId("admin-email-status")).toHaveText("Tasdiqlangan");
    await expect(admin.getByTestId("mark-email-verified")).toHaveCount(0);
    await adminCtx.close();

    await tryLogin(page, legacy, PASSWORD);
    await page.waitForURL("**/dashboard");
  });

  test("password reset: link sets a new password, other sessions are closed", async ({ page, browser }) => {
    // A second device that stays signed in with the old password.
    const otherDevice = await browser.newContext();
    const device = await otherDevice.newPage();
    await signIn(device, email, PASSWORD);
    await device.waitForURL("**/dashboard");

    const before = await countMails(email, RESET_SUBJECT);
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Tiklash havolasini yuborish" }).click();
    await expect(page.getByText("Xavfsizlik sababli hisob holati ko‘rsatilmaydi")).toBeVisible();
    const mail = await nextMail(email, RESET_SUBJECT, before);

    // Unknown addresses get the same answer and no email (no account enumeration).
    const nobody = testAddress(`nobody-${RUN}`);
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(nobody);
    await page.getByRole("button", { name: "Tiklash havolasini yuborish" }).click();
    await expect(page.getByText("Xavfsizlik sababli hisob holati ko‘rsatilmaydi")).toBeVisible();

    await page.goto(linkIn(mail));
    await page.waitForURL("**/reset-password?token=**");
    await page.getByLabel("Yangi parol", { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel("Yangi parolni tasdiqlang").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Parolni yangilash" }).click();
    await page.waitForURL("**/login");

    // The link works once only.
    await page.goto(linkIn(mail));
    await expect(page.getByText("Havola yaroqsiz yoki muddati tugagan")).toBeVisible();

    await tryLogin(page, email, PASSWORD);
    await expect(page.getByText("Email yoki parol noto‘g‘ri")).toBeVisible();
    await signIn(page, email, NEW_PASSWORD);
    await page.waitForURL("**/dashboard");

    // The other device was signed out by the reset.
    await device.goto("/dashboard");
    await device.waitForURL("**/login**");
    await otherDevice.close();
    expect(await countMails(nobody, RESET_SUBJECT)).toBe(0);
  });

  test("changing the email sends a verification email to the new address", async ({ page }) => {
    const changed = testAddress(`mail-new-${RUN}`);
    await signIn(page, email, NEW_PASSWORD);
    await page.waitForURL("**/dashboard");
    await page.goto("/dashboard/settings");
    const form = page.getByTestId("change-email-form");
    await form.getByLabel("Yangi email").fill(changed);
    await form.getByLabel("Joriy parol").fill(NEW_PASSWORD);
    await form.getByRole("button", { name: "Emailni o‘zgartirish" }).click();
    await expect(page.getByText("Yangi manzilga tasdiqlash xati yuborildi")).toBeVisible();
    const mail = await nextMail(changed, VERIFY_SUBJECT);
    await page.goto(linkIn(mail));
    await expect(page.getByRole("heading", { name: "Email tasdiqlandi" })).toBeVisible();
  });
});
