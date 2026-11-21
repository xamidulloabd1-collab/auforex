/**
 * Creates or promotes a super admin (the only administrative role).
 *
 *   npm run admin:create -- --email you@example.com --password "Strong-Pass-2026" --name "Ism Familiya"
 *   npm run admin:create -- --email existing-user@example.com      # promote an existing account
 *   npm run admin:create -- --email helper@example.com --username helper --password "…"   # with a login
 */
import { parseArgs } from "node:util";
import { createScriptPrisma, ensureAdmin } from "../prisma/seed-helpers";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    password: { type: "string" },
    name: { type: "string" },
    username: { type: "string" },
  },
});

async function main() {
  const email = values.email ?? process.env.ADMIN_EMAIL;
  if (!email) throw new Error("Pass --email or set ADMIN_EMAIL");
  const prisma = createScriptPrisma();
  try {
    const res = await ensureAdmin(prisma, {
      email,
      password: values.password ?? process.env.ADMIN_PASSWORD,
      name: values.name ?? process.env.ADMIN_NAME,
      username: values.username,
      role: "SUPER_ADMIN",
    });
    console.log(res.created ? `Super admin ${email} created.` : `User ${email} is now a super admin.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
