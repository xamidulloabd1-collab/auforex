# Vercel’da ishlatish (auforex.vercel.app)

Sayt Vercel + Prisma Postgres’da ishlaydi. Fayllar (video, kitob, rasm) uchun alohida ombor kerak —
[FAYL-SAQLASH.md](FAYL-SAQLASH.md).

## Deploy paytida nima bo‘ladi

`vercel.json` → `npm run build:vercel` (`scripts/vercel-build.mjs`):

1. Majburiy sozlamalar tekshiriladi (`DATABASE_URL`, `BETTER_AUTH_SECRET`). Biri yo‘q bo‘lsa, build aniq xabar bilan
   to‘xtaydi va Vercel eski ishlayotgan versiyani ko‘rsatishda davom etadi.
2. **Faqat Production**: `prisma migrate status` ko‘rsatiladi, keyin `prisma migrate deploy` yangi migratsiyalarni
   qo‘llaydi. Bu buyruq hech qachon bazani tozalamaydi va jadvallarni o‘chirmaydi. Preview deploy’lar bazaga tegmaydi.
3. Seed **ishga tushmaydi** (faqat `SEED_ON_BUILD=true` bo‘lsa). Production ma’lumotlari faqat migratsiya va Super admin
   orqali o‘zgaradi.
4. `next build`.

## Bu versiyani deploy qilishdan oldin: zaxira nusxa

Bu versiyada bitta yangi migratsiya bor — `20261123120000_lesson_category_number_access`:

- `Lesson` jadvaliga `categoryId`, `level`, `isFree` ustunlari qo‘shiladi (mavjud darslar PRO bo‘lib qoladi);
- har bir darsga kursining kategoriyasi yoziladi;
- bir kurs ichida dars raqami takrorlansa yoki 0 bo‘lsa, **faqat o‘sha kurs** darslari 1, 2, 3 … tartibda qayta
  raqamlanadi (avvalgi tartib saqlanadi), keyin “bir kursda bir xil raqam bo‘lmasin” cheklovi qo‘yiladi.

Hech narsa o‘chirilmaydi; talabalar progressi, foydalanuvchilar, kurslar va kitoblar o‘zgarmaydi. Shunday bo‘lsa ham,
deploy’dan oldin zaxira oling (Docker o‘rnatilgan kompyuterda):

```bash
# Vercel → Storage → bazangiz → .env.local yorlig‘idagi DATABASE_URL (db.prisma.io bilan) ni qo‘ying
docker run --rm postgres:18 pg_dump -Fc "postgres://…@db.prisma.io:5432/postgres?sslmode=require" > auforex-2026-11-23.dump
```

Fayl hajmi 0 bo‘lmasligi kerak. Qayta tiklash (faqat zarurat bo‘lsa): `pg_restore --clean --no-owner -d "<URL>" auforex-2026-11-23.dump`.

## O‘zgaruvchilar (Settings → Environment Variables)

**Majburiy**

| Nom | Qiymat |
|---|---|
| `DATABASE_URL` | Prisma Postgres ulanganda Vercel o‘zi qo‘yadi (`postgres://…@db.prisma.io:5432/…`). Migratsiyalar shu orqali |
| `BETTER_AUTH_SECRET` | 32+ belgili tasodifiy satr: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. **O‘zgartirmang** — o‘zgarsa hamma tizimdan chiqib ketadi |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Fayl ombori — [FAYL-SAQLASH.md](FAYL-SAQLASH.md). Busiz video/kitob/rasm yuklab bo‘lmaydi |

**Tavsiya etiladi**

| Nom | Qiymat |
|---|---|
| `DATABASE_URL_POOLED` | Ixtiyoriy override: `DATABASE_URL` bilan bir xil, faqat host `pooled.db.prisma.io`. Vercel’da bu o‘rnatilmasa va `DATABASE_URL` hosti `db.prisma.io` bo‘lsa, ilova pooler hostini avtomatik ishlatadi. Migratsiyalar baribir to‘g‘ridan-to‘g‘ri `DATABASE_URL`dan foydalanadi |
| `NEXT_PUBLIC_APP_URL` va `BETTER_AUTH_URL` | `https://auforex.vercel.app` (o‘z domeningiz bo‘lsa — u). Email havolalari shu manzilga ketadi. Yo‘q bo‘lsa, Vercel’ning production manzili olinadi |
| `TRUSTED_ORIGINS` | Saytga boshqa manzildan ham kirilsa (masalan `www.` varianti), vergul bilan |

**Ixtiyoriy**

| Nom | Ma’nosi |
|---|---|
| `S3_REGION` | `auto` (R2). AWS S3 bo‘lsa, mintaqa |
| `BUNNY_STREAM_TOKEN_KEY` | Bunny Stream havolalari ishlatilsa — [VIDEO-DARSLAR.md](VIDEO-DARSLAR.md) |
| `DB_POOL_MAX` | Har bir server nusxasidagi ulanishlar soni. Vercel’da standart 2 |
| `MIGRATE_ON_BUILD` | `false` — production deploy’da migratsiyani o‘tkazib yuborish; `true` — preview’da ham qo‘llash |
| `SEED_ON_BUILD` | `true` — deploy’da seed (kategoriyalar, sozlamalar, asoschi akkaunti). Mavjud ma’lumotlarni o‘chirmaydi, lekin odatda kerak emas |
| `FOUNDER_PASSWORD` | Faqat seed asoschi akkauntini **birinchi marta** yaratganda. Mavjud parolni o‘zgartirmaydi |
| `SMTP_*`, `MAIL_FROM` | Parolni tiklash xatlari uchun |
| `MAX_VIDEO_UPLOAD_MB`, `MAX_BOOK_UPLOAD_MB`, `MAX_IMAGE_UPLOAD_MB` | Yuklash chegaralari (2048 / 100 / 5) |

O‘zgaruvchini qo‘shgach yoki o‘zgartirgach: **Deployments → oxirgi deploy → ⋯ → Redeploy**.

## Deploy’dan keyin tekshirish

1. Vercel → Deployments → yangi deploy → **Building** loglarida: `[vercel-build] Migratsiyalarni qo‘llash …`
   qatoridan keyin Prisma’ning `All migrations have been successfully applied` (yoki `No pending migrations to apply`)
   xabari, oxirida `✓ Compiled successfully`. `Migratsiyalar qo‘llanmadi` bo‘lsa — build to‘xtaydi, eski versiya ishlab turadi.
2. `https://auforex.vercel.app/api/health`:
   ```json
   {"status":"ok","migrationsApplied":4,
    "site":{"url":"https://auforex.vercel.app","https":true,"matchesRequest":true},
    "database":{"pooled":true,"poolMax":2},
    "storage":{"driver":"s3","uploads":"ok"}}
   ```
   - `migrationsApplied` — bazadagi migratsiyalar soni (shu versiyada kamida 4).
   - `database.hint` chiqsa — `DATABASE_URL_POOLED` yoki Prisma Postgres pooler hostini tekshiring.
   - `storage.uploads: "not_configured"` — S3_* kiritilmagan.
3. Brauzerda: chiqib, qayta kiring (email va login bilan) → Dashboard ochilsin; telefondan ham.
4. Super admin → Darslar / Kategoriyalar / Kitoblar ochilsin; kichik video yuklab, saqlab, dars sahifasida ko‘ring.
5. Kitoblar → biror kitobni oching (PDF sahifalari ko‘rinsin).
6. Asoschi yoki kitob muqovasi rasmi `/_next/image` orqali optimallashtirilib ochilishini tekshiring.

## Kirishda xato chiqsa

| Ekrandagi xabar | Sabab | Yechim |
|---|---|---|
| “Xavfsizlik tekshiruvi o‘tmadi …” | Saytga ro‘yxatda yo‘q manzildan kirilgan | `TRUSTED_ORIGINS` ga o‘sha manzilni qo‘shing, Redeploy |
| “Sayt sozlamalarida xatolik bor …” | Majburiy o‘zgaruvchi yo‘q/noto‘g‘ri | Vercel → Logs: `[auth] Server sozlamalari noto‘g‘ri` qatorida qaysi biri yozilgan; tuzating, Redeploy |
| “Serverda vaqtinchalik xatolik …” | Baza javob bermadi | `/api/health` ni oching; `database_unavailable` bo‘lsa — Prisma Postgres holatini tekshiring |
| “Email yoki parol noto‘g‘ri” | Parol xato | “Parolni unutdingizmi?” (SMTP kerak) yoki Super admin → Foydalanuvchilar |

## Kompyuterda (lokal) ishga tushirish va .env fayllari

Yangi kod olingandan keyin (git pull, patch yoki ZIP) avval **`npm install`** — `package.json` o‘zgargan bo‘lishi
mumkin. Busiz VS Code “Cannot find module '@vercel/functions'” deydi va `npm run dev` ishga tushmaydi (oldindan
tekshiruv qaysi paket yetishmasligini aytadi).

`npm run dev` .env fayllarini Next.js tartibida o‘qiydi — yuqoridagisi ustun:

| Buyruq | O‘qiladigan fayllar (ustuvorlik bo‘yicha) |
|---|---|
| `npm run dev`, `npx prisma …`, `npm run db:seed`, `npm run doctor` | `.env.development.local` → `.env.local` → `.env.development` → `.env` |
| `next build`, `next start` | `.env.production.local` → `.env.local` → `.env.production` → `.env` |

- Birinchi topilgan qiymat olinadi, **bo‘sh bo‘lsa ham**: `.env.local` dagi `BETTER_AUTH_SECRET=""` `.env` dagi to‘g‘ri
  kalitni bekor qiladi → ro‘yxatdan o‘tish 503 “BETTER_AUTH_SECRET is required”.
- `.env.production.local` ni `npm run dev` umuman o‘qimaydi.
- `vercel env pull` Development qiymatlarini `.env.local` ga yozadi. **Sensitive** deb belgilangan o‘zgaruvchilarni
  Vercel qayta o‘qib bermaydi — ular bo‘sh qator bo‘lib tushadi. Bunday bo‘sh qatorlarni `.env.local` dan o‘chiring.
- `.env` faylini o‘zgartirgach `npm run dev` ni qayta ishga tushiring: o‘chirilgan qiymatlar ishlab turgan server
  xotirasida qolib ketadi.

`npm run dev` dan oldingi tekshiruv va `npm run doctor` har bir sozlama qaysi fayldan kelayotganini, sayt qaysi bazaga
(host:port/baza — login/parolsiz) ulanishini va bazaga ulanib bo‘lmasa sababini (vaqt tugadi, rad etildi, parol, DNS)
ko‘rsatadi. Qiymatlarning o‘zi hech qachon chiqarilmaydi.

**Production bazasini lokalda ishlatmang.** Lokal sayt unga ulansa, ro‘yxatdan o‘tish va admin amallari haqiqiy saytga
yoziladi. Lokal baza: `npm run db:fix` (Docker), so‘ng `npx prisma migrate deploy` va `npm run db:seed`.
Himoya: `prisma migrate reset`, `prisma migrate dev` va `prisma db push --force-reset` bu kompyuterda bo‘lmagan bazada
ishlamaydi (`ALLOW_REMOTE_DB_RESET=yes` bilan ataylab ruxsat beriladi).

“Ma’lumotlar bazasiga ulanib bo‘lmadi … vaqt tugadi” — bu kompyuterdan baza serveriga yo‘l yo‘q: provayder yoki firewall
5432-portni yopgan, VPN kerak yoki manzil noto‘g‘ri. Tekshirish (PowerShell): `Test-NetConnection db.prisma.io -Port 5432`.

## Cheklovlar

- Vercel **Hobby** tarifi tijoriy loyihalar uchun mo‘ljallanmagan; PRO sotuvlari boshlanganda **Pro** tarifiga o‘ting.
- Bitta funksiya javobi 4,5 MB gacha: kitoblar sahifama-sahifa (4 MB bo‘laklarda) o‘qiladi, video esa to‘g‘ridan-to‘g‘ri
  ombordan imzoli havola orqali o‘ynaydi.
