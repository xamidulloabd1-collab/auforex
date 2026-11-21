// One-time local setup, works the same on Windows, macOS and Linux:
//   npm run setup
// Creates .env from .env.example (if missing), generates BETTER_AUTH_SECRET and a founder
// password when they are empty, then prints the next steps. Existing values are never replaced.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getEnvValue, isWeakSecret, localDbPort, setEnvValue, strongPassword } from "./lib/env-file.mjs";

const root = process.cwd();
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

let created = false;
if (!existsSync(envPath)) {
  writeFileSync(envPath, readFileSync(examplePath, "utf8"));
  created = true;
}
let text = readFileSync(envPath, "utf8");
const changes = [];

if (isWeakSecret(getEnvValue(text, "BETTER_AUTH_SECRET"))) {
  text = setEnvValue(text, "BETTER_AUTH_SECRET", randomBytes(48).toString("base64url"));
  changes.push("BETTER_AUTH_SECRET yaratildi");
}
let founderPassword = getEnvValue(text, "FOUNDER_PASSWORD");
if (!founderPassword) {
  founderPassword = strongPassword(randomBytes);
  text = setEnvValue(text, "FOUNDER_PASSWORD", founderPassword);
  changes.push("FOUNDER_PASSWORD yaratildi");
}
// docker compose publishes the database on DB_PORT; keep it equal to the port in DATABASE_URL
// (older .env files have no DB_PORT — e.g. a database moved to 5433 keeps working).
const urlPort = localDbPort(getEnvValue(text, "DATABASE_URL"));
if (urlPort && !getEnvValue(text, "DB_PORT")) {
  text = setEnvValue(text, "DB_PORT", urlPort);
  changes.push(`DB_PORT=${urlPort} (DATABASE_URL bilan bir xil)`);
}
writeFileSync(envPath, text);

const login = getEnvValue(text, "FOUNDER_USERNAME") || "asadbek";
console.log("");
console.log(created ? "✓ .env fayli .env.example’dan yaratildi" : "✓ .env fayli mavjud (bor qiymatlar o‘zgartirilmadi)");
for (const c of changes) console.log(`✓ ${c}`);
console.log("");
console.log("Founder (super admin) kirishi — seed’dan keyin ishlaydi:");
console.log(`  login : ${login}`);
console.log(`  parol : ${founderPassword}`);
console.log("");
console.log("Keyingi qadamlar:");
console.log("  1. Bazani ishga tushiring         →  npm run db:fix   (Docker Desktop ochiq bo‘lsin)");
console.log("     o‘z PostgreSQL’ingiz bo‘lsa — .env’dagi DATABASE_URL’ni unga moslang");
console.log("  2. Jadvallarni yarating            →  npx prisma migrate deploy");
console.log("  3. Boshlang‘ich ma’lumotlar        →  npm run db:seed");
console.log("  4. Tekshiruv                       →  npm run doctor");
console.log("  5. Ishga tushiring                 →  npm run dev   →  http://localhost:3000");
console.log("");
console.log("Founder paroli bazada allaqachon boshqacha bo‘lsa:  npm run founder:password");
