import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Email flows against a real SMTP server: registration with verification, resending the
 * verification email, password reset (old sessions closed) and changing the email address.
 *
 * Runs only when E2E_MAILBOX_DIR is set: the server must be started with SMTP_* pointing at a test
 * SMTP server that stores every message as a .eml file in that folder (see docs/TEST_RESULTS.md).
 * Email verification must be on (the default in production when SMTP is configured).
 */
const MAILBOX = process.env.E2E_MAILBOX_DIR;
const RUN = Date.now().toString(36);
const PASSWORD = "Trader2026x";
const NEW_PASSWORD = "Trader2027y";

test.skip(!MAILBOX, "E2E_MAILBOX_DIR is not set (no test SMTP server)");

type Mail = { to: string; subject: string; text: string };

function decodeQuotedPrintable(s: string) {
  const bytes = Buffer.from(s.replace(/=\r?\n/g, ""), "binary");
  const out: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x3d && /^[0-9A-F]{2}$/i.test(bytes.toString("binary", i + 1, i + 3))) {
      out.push(parseInt(bytes.toString("binary", i + 1, i + 3), 16));
      i += 2;
    } else out.push(bytes[i]!);
  }
  return Buffer.from(out).toString("utf8");
}

function decodeHeader(value: string) {
  return value.replace(/=\?utf-8\?([bq])\?([^?]*)\?=/gi, (_, enc: string, data: string) =>
    enc.toLowerCase() === "b" ? Buffer.from(data, "base64").toString("utf8") : decodeQuotedPrintable(data.replace(/_/g, " ")),
  );
}

/** Minimal MIME reader: headers plus the decoded text/plain part. */
function parseMail(raw: string): Mail {
  const [head = "", ...rest] = raw.split(/\r?\n\r?\n/);
  const headers = head.replace(/\r?\n[ \t]+/g, " ");
  const header = (name: string) => decodeHeader(new RegExp(`^${name}:\\s*(.*)$`, "im").exec(headers)?.[1]?.trim() ?? "");
  const body = rest.join("\n\n");
  const boundary = /boundary="?([^";\s]+)"?/i.exec(headers)?.[1];
  const parts = boundary ? body.split(`--${boundary}`) : [`${head}\n\n${body}`];
  let text = "";
  for (const part of parts) {
    const [ph = "", ...pb] = part.replace(/^\r?\n/, "").split(/\r?\n\r?\n/);
    if (boundary && !/content-type:\s*text\/plain/i.test(ph)) continue;
    const content = pb.join("\n\n");
    text = /content-transfer-encoding:\s*base64/i.test(ph)
      ? Buffer.from(content.replace(/\s+/g, ""), "base64").toString("utf8")
      : /content-transfer-encoding:\s*quoted-printable/i.test(ph)
        ? decodeQuotedPrintable(content)
        : content;
    break;
  }
  return { to: header("To"), subject: header("Subject"), text };
}

function mails(): Mail[] {
  return readdirSync(MAILBOX!)
    .filter((f) => f.endsWith(".eml"))
    .sort()
    .map((f) => parseMail(readFileSync(path.join(MAILBOX!, f), "latin1")));
}

/** Waits for the next message to `to` whose subject matches, after `seen` earlier ones. */
async function nextMail(to: string, subject: RegExp, seen = 0): Promise<Mail> {
  let found: Mail | undefined;
  await expect
    .poll(
      () => {
        const list = mails().filter((m) => m.to.includes(to) && subject.test(m.subject));
        found = list[seen];
        return Boolean(found);
      },
      { timeout: 20_000 },
    )
    .toBe(true);
  return found!;
}

const countMails = (to: string, subject: RegExp) => mails().filter((m) => m.to.includes(to) && subject.test(m.subject)).length;

function linkIn(mail: Mail) {
  const url = /https?:\/\/\S+/.exec(mail.text)?.[0];
  expect(url, "the email contains a link").toBeTruthy();
  return url!;
}

async function signIn(page: Page, id: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email yoki login").fill(id);
  await page.getByLabel("Parol", { exact: true }).fill(password);
  await page.getByTestId("login-form").getByRole("button", { name: "Kirish" }).click();
}

const VERIFY = /tasdiqlang/i;
const RESET = /parolni tiklash/i;

test.describe.serial("Email: verification and password reset", () => {
  const email = `mail-${RUN}@example.com`;

  test("registration sends a verification email; the link verifies and signs in", async ({ page, baseURL }) => {
    await page.goto("/register");
    await page.getByLabel("Ism va familiya").fill("Mail Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Parol", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Parolni tasdiqlang").fill(PASSWORD);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Ro‘yxatdan o‘tish" }).click();
    await expect(page.getByTestId("verify-email-notice")).toContainText(email);
    await expect(page.getByTestId("verify-email-notice")).toContainText("tasdiqlash havolasi yuborildi");

    // Not verified yet: sign-in is refused with a resend option.
    await signIn(page, email, PASSWORD);
    await expect(page.getByText("Email manzilingiz hali tasdiqlanmagan")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tasdiqlash xatini qayta yuborish" })).toBeVisible();

    const mail = await nextMail(email, VERIFY);
    expect(mail.text).toContain("Mail Tester");
    const link = linkIn(mail);
    // Links point at the configured site address, never at another host.
    expect(new URL(link).origin).toBe(new URL(baseURL!).origin);

    await page.goto(link);
    await page.waitForURL("**/verify-email**");
    await expect(page.getByRole("heading", { name: "Email tasdiqlandi" })).toBeVisible();
    await page.getByRole("link", { name: "Shaxsiy kabinetga o‘tish" }).click();
    await page.waitForURL("**/dashboard");

    // The same link cannot be used to verify anything else (already verified → still fine),
    // a forged token is rejected.
    await page.goto(`/api/auth/verify-email?token=forged.${RUN}&callbackURL=%2Fverify-email`);
    await expect(page.getByRole("heading", { name: "Havola yaroqsiz" })).toBeVisible();
  });

  test("an unverified account can request the verification email again", async ({ page }) => {
    const other = `mail2-${RUN}@example.com`;
    await page.goto("/register");
    await page.getByLabel("Ism va familiya").fill("Second Tester");
    await page.getByLabel("Email").fill(other);
    await page.getByLabel("Parol", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Parolni tasdiqlang").fill(PASSWORD);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Ro‘yxatdan o‘tish" }).click();
    await expect(page.getByTestId("verify-email-notice")).toBeVisible();
    await nextMail(other, VERIFY);
    const before = countMails(other, VERIFY);

    await signIn(page, other, PASSWORD);
    await page.getByRole("button", { name: "Tasdiqlash xatini qayta yuborish" }).click();
    await expect(page.getByText("Tasdiqlash xati qayta yuborildi")).toBeVisible();
    await nextMail(other, VERIFY, before);
  });

  test("password reset: link sets a new password, other sessions are closed", async ({ page, browser }) => {
    // A second device that stays signed in with the old password.
    const otherDevice = await browser.newContext();
    const device = await otherDevice.newPage();
    await signIn(device, email, PASSWORD);
    await device.waitForURL("**/dashboard");

    const before = countMails(email, RESET);
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Tiklash havolasini yuborish" }).click();
    await expect(page.getByText("Xavfsizlik sababli hisob holati ko‘rsatilmaydi")).toBeVisible();
    const mail = await nextMail(email, RESET, before);

    // Unknown addresses get the same answer and no email (no account enumeration).
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(`nobody-${RUN}@example.com`);
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

    await signIn(page, email, PASSWORD);
    await expect(page.getByText("Email yoki parol noto‘g‘ri")).toBeVisible();
    await signIn(page, email, NEW_PASSWORD);
    await page.waitForURL("**/dashboard");

    // The other device was signed out by the reset.
    await device.goto("/dashboard");
    await device.waitForURL("**/login**");
    await otherDevice.close();
  });

  test("changing the email sends a verification email to the new address", async ({ page }) => {
    const changed = `mail-new-${RUN}@example.com`;
    await signIn(page, email, NEW_PASSWORD);
    await page.waitForURL("**/dashboard");
    await page.goto("/dashboard/settings");
    const form = page.getByTestId("change-email-form");
    await form.getByLabel("Yangi email").fill(changed);
    await form.getByLabel("Joriy parol").fill(NEW_PASSWORD);
    await form.getByRole("button", { name: "Emailni o‘zgartirish" }).click();
    await expect(page.getByText("Yangi manzilga tasdiqlash xati yuborildi")).toBeVisible();
    const mail = await nextMail(changed, VERIFY);
    await page.goto(linkIn(mail));
    await expect(page.getByRole("heading", { name: "Email tasdiqlandi" })).toBeVisible();
  });
});
