import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env, isMailConfigured } from "@/lib/env";

let transporter: Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const e = env();
  transporter = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT ?? 587,
    secure: e.SMTP_SECURE ?? (e.SMTP_PORT === 465),
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Sends an email via SMTP when configured.
 * Without SMTP: in development the message (including links) is printed to the
 * server console; in production only a warning is logged (links are never logged).
 */
export async function sendMail(message: MailMessage): Promise<{ delivered: boolean }> {
  if (!isMailConfigured()) {
    if (env().NODE_ENV !== "production") {
      console.info(
        `\n[mail:dev] SMTP sozlanmagan — xat konsolga chiqarildi\nTo: ${message.to}\nSubject: ${message.subject}\n${message.text}\n`,
      );
    } else {
      console.warn(`[mail] SMTP is not configured; email "${message.subject}" was not sent.`);
    }
    return { delivered: false };
  }

  await getTransporter().sendMail({
    from: env().MAIL_FROM,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  return { delivered: true };
}
