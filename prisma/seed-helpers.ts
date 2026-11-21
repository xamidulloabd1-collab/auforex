/**
 * Helpers shared by `prisma/seed.ts` and `scripts/create-admin.ts`.
 * These run outside Next.js (via tsx), so they must not import `server-only` modules.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../lib/db/generated/client";

export function createScriptPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set (see .env.example)");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export type ScriptPrisma = ReturnType<typeof createScriptPrisma>;

export function assertStrongPassword(password: string) {
  if (password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error("Parol kamida 12 belgidan iborat bo‘lib, harf va raqam qatnashishi kerak.");
  }
}

type AdminRole = "SUPER_ADMIN";

/** Strong random password: 18 chars, letters + digits + symbols, no ambiguous characters. */
export function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const symbols = "!#%+-=?@";
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const chars = Array.from(bytes, (b, i) => (i % 6 === 5 ? symbols[b % symbols.length] : alphabet[b % alphabet.length]));
  return `${chars.join("")}7a`;
}

/**
 * Creates a super admin account (credential provider, scrypt hash via Better Auth)
 * or promotes an existing user. Never overwrites a password.
 */
export async function ensureAdmin(
  prisma: ScriptPrisma,
  input: { email: string; password?: string; name?: string; role?: AdminRole; username?: string },
) {
  const role: AdminRole = input.role ?? "SUPER_ADMIN";
  const email = input.email.trim().toLowerCase();
  const username = input.username?.trim().toLowerCase() || undefined;
  if (username && !/^[a-z0-9_.]{3,30}$/.test(username)) throw new Error("Login must be 3-30 chars: a-z, 0-9, _ or .");

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, ...(username ? [{ username }] : [])] },
  });

  if (existing) {
    const nextRole = role;
    const usernameFree = username && !(await prisma.user.findFirst({ where: { username, NOT: { id: existing.id } } }));
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: nextRole, status: "ACTIVE", ...(usernameFree && !existing.username ? { username } : {}) },
    });
    await prisma.subscription.upsert({ where: { userId: existing.id }, update: {}, create: { userId: existing.id } });
    return { id: existing.id, created: false };
  }

  if (!input.password) throw new Error(`User ${email} does not exist; a password is required to create it.`);
  assertStrongPassword(input.password);
  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email,
      username: username ?? null,
      name: input.name?.trim() || "Administrator",
      emailVerified: true,
      role,
      subscription: { create: { status: "FREE" } },
    },
  });
  // Better Auth uses the user id as the credential accountId.
  await prisma.account.create({ data: { userId: user.id, providerId: "credential", accountId: user.id, password: passwordHash } });
  return { id: user.id, created: true };
}
