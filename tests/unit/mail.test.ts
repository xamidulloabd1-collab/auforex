import { describe, expect, it } from "vitest";
import { checkEnv, emailVerificationRequired } from "@/lib/env-schema";
import { classifyMailError, MailDeliveryError, smtpSecure } from "@/lib/mail/smtp";

const required = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "x".repeat(40),
};

describe("SMTP settings", () => {
  it("port 465 uses TLS unless SMTP_SECURE says otherwise; an empty value means “not set”", () => {
    const parsed = checkEnv({ ...required, SMTP_HOST: "smtp.example.com", MAIL_FROM: "a@b.uz", SMTP_PORT: "465", SMTP_SECURE: "" });
    expect(parsed.ok && parsed.data.SMTP_SECURE).toBeUndefined();
    expect(smtpSecure(465, undefined)).toBe(true);
    expect(smtpSecure(587, undefined)).toBe(false);
    expect(smtpSecure(465, false)).toBe(false);
    expect(smtpSecure(587, true)).toBe(true);
    const explicit = checkEnv({ ...required, SMTP_HOST: "h", MAIL_FROM: "a@b.uz", SMTP_SECURE: "false" });
    expect(explicit.ok && explicit.data.SMTP_SECURE).toBe(false);
  });

  it("SMTP_HOST needs MAIL_FROM; login and password come as a pair", () => {
    expect(checkEnv({ ...required, SMTP_HOST: "h" }).ok).toBe(false);
    expect(checkEnv({ ...required, SMTP_HOST: "h", MAIL_FROM: "a@b.uz", SMTP_USER: "u" }).ok).toBe(false);
    expect(checkEnv({ ...required, SMTP_HOST: "h", MAIL_FROM: "a@b.uz", SMTP_USER: "u", SMTP_PASSWORD: "p" }).ok).toBe(true);
  });

  it("verification is on in production and with SMTP, unless explicitly turned off", () => {
    expect(emailVerificationRequired({ NODE_ENV: "production", REQUIRE_EMAIL_VERIFICATION: undefined }, false)).toBe(true);
    expect(emailVerificationRequired({ NODE_ENV: "development", REQUIRE_EMAIL_VERIFICATION: undefined }, true)).toBe(true);
    expect(emailVerificationRequired({ NODE_ENV: "development", REQUIRE_EMAIL_VERIFICATION: undefined }, false)).toBe(false);
    expect(emailVerificationRequired({ NODE_ENV: "production", REQUIRE_EMAIL_VERIFICATION: "false" }, true)).toBe(false);
  });
});

describe("mail errors are explained without leaking secrets", () => {
  it("classifies nodemailer failures", () => {
    expect(classifyMailError({ code: "EAUTH", responseCode: 535 }).reason).toBe("auth");
    expect(classifyMailError({ code: "ESOCKET" }).reason).toBe("connection");
    expect(classifyMailError({ code: "ETIMEDOUT" }).message).toMatch(/SMTP_SECURE/);
    expect(classifyMailError({ code: "EENVELOPE", responseCode: 553 }).reason).toBe("rejected");
    expect(classifyMailError(new Error("boom")).reason).toBe("other");
    const original = new MailDeliveryError("x", "not_configured");
    expect(classifyMailError(original)).toBe(original);
  });

  it("never repeats the raw error text (which may contain addresses or server replies)", () => {
    const msg = classifyMailError({ code: "EAUTH", message: "535 user secret@example.com password hunter2" }).message;
    expect(msg).not.toMatch(/hunter2|secret@example\.com/);
  });
});
