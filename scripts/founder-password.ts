/**
 * Sets (or resets) the founder's super admin password in YOUR database and signs out
 * the founder's other sessions. Creates the founder account if it does not exist yet.
 *
 *   npm run founder:password                       # uses FOUNDER_PASSWORD from .env, or generates one
 *   npm run founder:password Yangi-Parol-2026      # a password of your choice (12+ chars, letters + digits)
 *   npx tsx scripts/founder-password.ts --password "Yangi-Parol-2026"
 */
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { hashPassword } from "better-auth/crypto";
import { assertStrongPassword, createScriptPrisma, ensureAdmin } from "../prisma/seed-helpers";
import { FOUNDER_PROFILE } from "../lib/settings/schema";
import { strongPassword } from "./lib/env-file.mjs";

const { values, positionals } = parseArgs({
  options: { password: { type: "string" } },
  allowPositionals: true,
  strict: false,
});

async function main() {
  const username = (process.env.FOUNDER_USERNAME || "asadbek").trim().toLowerCase();
  const email = (process.env.FOUNDER_EMAIL || "founder@auforex.local").trim().toLowerCase();
  const given = (typeof values.password === "string" ? values.password : undefined) ?? positionals[0] ?? process.env.FOUNDER_PASSWORD;
  const password = given?.trim() || strongPassword(randomBytes);
  assertStrongPassword(password);

  const prisma = createScriptPrisma();
  try {
    const user = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] }, select: { id: true, username: true, email: true } });
    if (!user) {
      await ensureAdmin(prisma, { email, username, password, name: process.env.FOUNDER_NAME || FOUNDER_PROFILE.name, role: "SUPER_ADMIN" });
      console.log(`✓ Founder hisobi yaratildi.`);
    } else {
      const hash = await hashPassword(password);
      const account = await prisma.account.findFirst({ where: { userId: user.id, providerId: "credential" }, select: { id: true } });
      await prisma.$transaction([
        account
          ? prisma.account.update({ where: { id: account.id }, data: { password: hash } })
          : prisma.account.create({ data: { userId: user.id, providerId: "credential", accountId: user.id, password: hash } }),
        prisma.user.update({ where: { id: user.id }, data: { role: "SUPER_ADMIN", status: "ACTIVE" } }),
        prisma.session.deleteMany({ where: { userId: user.id } }),
      ]);
      console.log(`✓ Founder paroli yangilandi, boshqa qurilmalardagi sessiyalar yopildi.`);
    }
    console.log("");
    console.log(`  Manzil : ${(process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")}/login`);
    console.log(`  Login  : ${user?.username ?? username}   (yoki email: ${user?.email ?? email})`);
    console.log(`  Parol  : ${password}`);
    console.log("");
    console.log("Kirgandan keyin parolni Shaxsiy kabinet → Profil sozlamalari’da almashtirishingiz mumkin.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  const text = `${String(err)} ${JSON.stringify(err, Object.getOwnPropertyNames(err ?? {}))}`;
  if (/P1000|AuthenticationFailed|ECONNREFUSED|P1001|Can't reach database|TableDoesNotExist|P2021/i.test(text)) {
    console.error(
      /TableDoesNotExist|P2021/i.test(text)
        ? "✗ Jadvallar hali yo‘q. Avval:  npx prisma migrate deploy   so‘ng:  npm run db:seed"
        : "✗ Ma’lumotlar bazasiga ulanib bo‘lmadi. Avtomatik tuzatish:  npm run db:fix",
    );
    process.exitCode = 1;
    return;
  }
  console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
  console.error("  Tekshiruv:  npm run doctor");
  process.exitCode = 1;
});
