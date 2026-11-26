/**
 * SMTP transport and error classification. No `server-only` import: `npm run mail:check` uses it.
 */
import nodemailer from "nodemailer";

export type SmtpSettings = {
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_SECURE?: boolean;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
};

/** Port 465 is implicit TLS; 587/25 start plain and upgrade with STARTTLS. */
export function smtpSecure(port: number, secure: boolean | undefined) {
  return secure ?? port === 465;
}

export function createSmtpTransport(s: SmtpSettings) {
  const port = s.SMTP_PORT ?? 587;
  return nodemailer.createTransport({
    host: s.SMTP_HOST,
    port,
    secure: smtpSecure(port, s.SMTP_SECURE),
    auth: s.SMTP_USER ? { user: s.SMTP_USER, pass: s.SMTP_PASSWORD } : undefined,
    // A mail server that does not answer must not hold a request (or a serverless function)
    // for minutes: fail fast with a clear error instead.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

/** Sending failed (server down, login refused, address rejected). The message is safe to show. */
export class MailDeliveryError extends Error {
  override name = "MailDeliveryError";
  constructor(
    message: string,
    readonly reason: "not_configured" | "auth" | "connection" | "rejected" | "other",
  ) {
    super(message);
  }
}

/** What went wrong, from a nodemailer error — for logs and the admin check; never the password. */
export function classifyMailError(err: unknown): MailDeliveryError {
  if (err instanceof MailDeliveryError) return err;
  const e = err as { code?: string; responseCode?: number; message?: string };
  const code = e?.code ?? "";
  if (code === "EAUTH" || e?.responseCode === 535 || e?.responseCode === 534) {
    return new MailDeliveryError("SMTP login yoki parol qabul qilinmadi (SMTP_USER / SMTP_PASSWORD)", "auth");
  }
  if (["ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "ECONNREFUSED", "ENOTFOUND", "EGREETING", "ETLS"].includes(code)) {
    return new MailDeliveryError(
      `Pochta serveriga ulanib bo‘lmadi (${code}) — SMTP_HOST, SMTP_PORT va SMTP_SECURE ni tekshiring (465 → SMTP_SECURE=true, 587 → false)`,
      "connection",
    );
  }
  if (code === "EENVELOPE" || (e?.responseCode !== undefined && e.responseCode >= 500)) {
    return new MailDeliveryError(
      `Pochta serveri xatni rad etdi (${e.responseCode ?? code}) — MAIL_FROM manzili shu SMTP hisobiga tegishli ekanini tekshiring`,
      "rejected",
    );
  }
  return new MailDeliveryError(`Xat yuborilmadi (${code || "noma’lum xato"})`, "other");
}
