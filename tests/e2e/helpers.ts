import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

/**
 * Shared E2E helpers: test email addresses, reading the emails the site sends, and registering a user
 * whether or not email verification is required.
 *
 * Mail sources (the first one configured is used):
 *   E2E_MAILBOX_DIR — a test SMTP server that saves every message as .eml (local runs);
 *   E2E_RESEND=1    — Resend’s API (deployed Preview). Addresses become Resend test addresses
 *                     (delivered+<label>@resend.dev), so no real person receives anything.
 *                     The API key comes from RESEND_API_KEY, or is added by a proxy.
 * Without a mail source, registration must not require verification (REQUIRE_EMAIL_VERIFICATION=false).
 */
const MAILBOX = process.env.E2E_MAILBOX_DIR;
const RESEND = process.env.E2E_RESEND === "1";

export const mailAvailable = Boolean(MAILBOX || RESEND);

/** A unique address for a test user. */
export function testAddress(label: string) {
  const clean = label.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return RESEND ? `delivered+${clean}@resend.dev` : `${clean}@example.com`;
}

export type Mail = { id: string; to: string; subject: string; text: string };

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
function parseEml(id: string, raw: string): Mail {
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
  return { id, to: header("To"), subject: header("Subject"), text };
}

const resendHeaders = () => ({ Authorization: `Bearer ${process.env.RESEND_API_KEY || "proxy-injected"}` });

async function resendJson(p: string) {
  const res = await fetch(`https://api.resend.com${p}`, { headers: resendHeaders() });
  if (!res.ok) throw new Error(`Resend ${p} → ${res.status}`);
  return res.json();
}

/** Messages to `to` whose subject matches, oldest first (only id/to/subject for Resend). */
async function listMails(to: string, subject: RegExp): Promise<Mail[]> {
  if (!mailAvailable) return [];
  if (MAILBOX) {
    return readdirSync(MAILBOX)
      .filter((f) => f.endsWith(".eml"))
      .sort()
      .map((f) => parseEml(f, readFileSync(path.join(MAILBOX, f), "latin1")))
      .filter((m) => m.to.toLowerCase().includes(to.toLowerCase()) && subject.test(m.subject));
  }
  const list = (await resendJson("/emails?limit=100")) as { data: { id: string; to: string[]; subject: string; created_at: string }[] };
  return list.data
    .filter((m) => m.to.some((t) => t.toLowerCase() === to.toLowerCase()) && subject.test(m.subject))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((m) => ({ id: m.id, to: m.to.join(","), subject: m.subject, text: "" }));
}

async function fullText(mail: Mail) {
  if (MAILBOX || mail.text) return mail.text;
  const full = (await resendJson(`/emails/${mail.id}`)) as { text: string | null; html: string | null };
  // The HTML part escapes "&" as "&amp;" inside links; the text part has the plain link.
  return full.text ?? (full.html ?? "").replace(/&amp;/g, "&");
}

export const VERIFY_SUBJECT = /tasdiqlang/i;
export const RESET_SUBJECT = /parolni tiklash/i;

export async function countMails(to: string, subject: RegExp) {
  return (await listMails(to, subject)).length;
}

/** Waits for the (seen+1)-th message to `to` whose subject matches and returns it with its text. */
export async function nextMail(to: string, subject: RegExp, seen = 0): Promise<Mail> {
  if (!mailAvailable) throw new Error("No mail source: set E2E_MAILBOX_DIR or E2E_RESEND=1");
  let found: Mail | undefined;
  await expect
    .poll(
      async () => {
        found = (await listMails(to, subject))[seen];
        return Boolean(found);
      },
      { timeout: 45_000, intervals: [1_000, 2_000, 3_000] },
    )
    .toBe(true);
  return { ...found!, text: await fullText(found!) };
}

export function linkIn(mail: Mail) {
  const url = /https?:\/\/[^\s<>"]+/.exec(mail.text)?.[0];
  expect(url, "the email contains a link").toBeTruthy();
  return url!;
}

export async function signIn(page: Page, id: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email yoki login").fill(id);
  await page.getByLabel("Parol", { exact: true }).fill(password);
  await page.getByTestId("login-form").getByRole("button", { name: "Kirish" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/**
 * Registers a user and ends on /dashboard signed in. When the site requires email verification,
 * the verification link is read from the mail source and opened (it signs the user in).
 */
export async function registerUser(page: Page, user: { name: string; email: string; password: string }) {
  await page.goto("/register");
  await page.getByLabel("Ism va familiya").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Parol", { exact: true }).fill(user.password);
  await page.getByLabel("Parolni tasdiqlang").fill(user.password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Ro‘yxatdan o‘tish" }).click();
  const notice = page.getByTestId("verify-email-notice");
  await expect(page.getByTestId("verify-email-notice").or(page.getByTestId("dashboard-plan")).first()).toBeVisible({ timeout: 30_000 });
  if (await notice.isVisible()) {
    await expect(notice).toContainText("tasdiqlash havolasi yuborildi");
    const mail = await nextMail(user.email, VERIFY_SUBJECT);
    await page.goto(linkIn(mail));
    await expect(page.getByRole("heading", { name: "Email tasdiqlandi" })).toBeVisible();
    await page.goto("/dashboard");
  }
  await page.waitForURL("**/dashboard");
}
