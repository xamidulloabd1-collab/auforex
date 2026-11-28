/**
 * Checks the SMTP settings from .env (or the shell):
 *   npm run mail:check                      — connect and log in only (nothing is sent)
 *   npm run mail:check -- --to siz@misol.uz  — also send a test email to that address
 * The password is never printed.
 */
import { checkEnv } from "../lib/env-schema";
import { classifyMailError, createSmtpTransport, smtpSecure } from "../lib/mail/smtp";
import { loadProjectEnv } from "./lib/env-load.mjs";

loadProjectEnv(process.cwd(), process.env.NODE_ENV === "production" ? "production" : "development");

async function main() {
  const arg = process.argv.indexOf("--to");
  const to = arg > -1 ? process.argv[arg + 1] : undefined;

  const result = checkEnv(process.env);
  if (!result.ok) {
    const mailIssues = result.issues.filter((i) => /SMTP|MAIL/.test(i));
    if (mailIssues.length) {
      for (const i of mailIssues) console.error(`✗ ${i}`);
      process.exit(1);
    }
  }
  const e = result.ok ? result.data : null;
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.MAIL_FROM?.trim();
  if (!host || !from) {
    console.error("✗ SMTP_HOST va MAIL_FROM kiritilmagan — pochta o‘chiq (docs/EMAIL.md).");
    process.exit(1);
  }
  const port = e?.SMTP_PORT ?? (Number(process.env.SMTP_PORT) || 587);
  const secure = smtpSecure(port, e?.SMTP_SECURE);
  console.log(`\nSMTP: ${host}:${port} · ${secure ? "TLS (SMTPS)" : "STARTTLS"} · login: ${process.env.SMTP_USER ? "bor" : "yo‘q"} · jo‘natuvchi: ${from}\n`);

  const transport = createSmtpTransport({
    SMTP_HOST: host,
    SMTP_PORT: port,
    SMTP_SECURE: e?.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER?.trim() || undefined,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  });
  try {
    await transport.verify();
    console.log("✓ Pochta serveriga ulanish va kirish");
  } catch (err) {
    console.log(`✗ Pochta serveriga ulanish va kirish\n    → ${classifyMailError(err).message}`);
    process.exit(1);
  }

  if (to) {
    try {
      await transport.sendMail({
        from,
        to,
        subject: "AU Forex Academy: test xat",
        text: "Bu test xat. Pochta sozlamalari to‘g‘ri ishlayapti.",
      });
      console.log(`✓ Test xat yuborildi: ${to} (Spam papkasini ham tekshiring)`);
    } catch (err) {
      console.log(`✗ Test xat yuborilmadi\n    → ${classifyMailError(err).message}`);
      process.exit(1);
    }
  } else {
    console.log("  Test xat yuborish uchun: npm run mail:check -- --to siz@misol.uz");
  }
  transport.close();
}

void main();
