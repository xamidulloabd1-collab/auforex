// Prints the variables for the Railway web service, with freshly generated secrets:
//   npm run deploy:env
// Paste the block into Railway → (web service) → Variables → Raw Editor.
import { randomBytes } from "node:crypto";
import { strongPassword } from "./lib/env-file.mjs";

const secret = randomBytes(48).toString("base64url");
const founderPassword = strongPassword(randomBytes);

console.log(`
Railway → web xizmati → Variables → Raw Editor — quyidagi blokni to‘liq joylang:
----------------------------------------------------------------------------
DATABASE_URL=\${{Postgres.DATABASE_URL}}
BETTER_AUTH_SECRET=${secret}
BETTER_AUTH_URL=https://\${{RAILWAY_PUBLIC_DOMAIN}}
NEXT_PUBLIC_APP_URL=https://\${{RAILWAY_PUBLIC_DOMAIN}}
STORAGE_LOCAL_ROOT=/app/storage
FOUNDER_USERNAME=asadbek
FOUNDER_PASSWORD=${founderPassword}
----------------------------------------------------------------------------
Founder kirishi (saqlab qo‘ying):  login: asadbek   parol: ${founderPassword}

• "Postgres" — Railway’dagi baza xizmatining nomi. Boshqacha bo‘lsa, shu so‘zni almashtiring.
• O‘z domeningizni (.uz) ulasangiz, BETTER_AUTH_URL va NEXT_PUBLIC_APP_URL’ni https://sizning-domen.uz qiling.
• Ixtiyoriy: SMTP_* (parolni tiklash xatlari), ADMIN_EMAIL/ADMIN_PASSWORD (qo‘shimcha super admin).
`);
