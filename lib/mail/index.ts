import "server-only";
import type { Transporter } from "nodemailer";
import { env, isMailConfigured } from "@/lib/env";
import { classifyMailError, createSmtpTransport, MailDeliveryError } from "./smtp";

export { MailDeliveryError } from "./smtp";

let transporter: Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = createSmtpTransport(env());
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
 * Without SMTP: in development the message (including links) is printed to the server console;
 * in production it fails with MailDeliveryError (links are never logged).
 */
export async function sendMail(message: MailMessage): Promise<{ delivered: boolean }> {
  if (!isMailConfigured()) {
    if (env().NODE_ENV !== "production") {
      console.info(
        `\n[mail:dev] SMTP sozlanmagan — xat konsolga chiqarildi\nTo: ${message.to}\nSubject: ${message.subject}\n${message.text}\n`,
      );
      return { delivered: false };
    }
    throw new MailDeliveryError("Pochta xizmati sozlanmagan (SMTP_HOST, MAIL_FROM)", "not_configured");
  }

  try {
    await getTransporter().sendMail({
      from: env().MAIL_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  } catch (err) {
    const failure = classifyMailError(err);
    // Subject and the reason only: the body holds one-time links and is never logged.
    console.error(`[mail] "${message.subject}" yuborilmadi: ${failure.message}`);
    throw failure;
  }
  return { delivered: true };
}

/** Connects and logs in to the SMTP server without sending anything (Super admin → Tizim). */
export async function verifyMailTransport(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isMailConfigured()) return { ok: false, error: "Pochta xizmati sozlanmagan (SMTP_HOST, MAIL_FROM)" };
  try {
    await getTransporter().verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: classifyMailError(err).message };
  }
}
