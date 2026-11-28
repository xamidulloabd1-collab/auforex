# Production reliz: holat, to‘siqlar va reja (27.11.2026)

> **Chiqarildi: 28.11.2026** — `main` = `d02a302`, Production `dpl_Gje78tVkafJDYpnLF6QAjquG3kMX` (S3_BUCKET tuzatilgandan keyin).
> Natijalar: [TEST_RESULTS.md](TEST_RESULTS.md). Keyingi reliz uchun orqaga qaytarish nuqtasi — shu deploy.
> Eski `dpl_5kiP8bxeumX7yJgCytGZqqfnFwmL` ga qaytilsa, R2 yana ishlamaydi (u noto‘g‘ri `auforec-media` bilan qurilgan).

PR #3 (`claude/final-stabilization`) ni `https://auforex.vercel.app` ga chiqarishdan oldingi tekshiruv.
Hamma tekshiruvlar **faqat o‘qish** rejimida bajarildi (Vercel, Cloudflare, Prisma, Resend API). Production bazasi,
production bucket’i, production sozlamalari va deploy’i o‘zgartirilmadi. Maxfiy qiymatlar o‘qilmadi va chiqarilmadi.

## 1. Production o‘zgaruvchilari (Vercel API, faqat nomlar)

| Nom | Muhit | Turi |
|---|---|---|
| `BETTER_AUTH_SECRET` | Production | Sensitive |
| `NEXT_PUBLIC_APP_URL` | Production | Encrypted |
| `TRUSTED_ORIGINS` | Production | Sensitive |
| `DATABASE_URL`, `DATABASE_URL_POOLED`, `POSTGRES_URL`, `PRISMA_DATABASE_URL` | **Preview + Production** | Sensitive |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Production | Sensitive |

- **Yo‘q:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` → 3-bo‘lim (asosiy to‘siq).
- `S3_SESSION_TOKEN` yo‘q → production kalitlari vaqtinchalik emas (2-bo‘lim).
- Hozirgi production deploy: `dpl_5kiP8bxeumX7yJgCytGZqqfnFwmL` — commit `68a3601`, 23.11.2026 21:05 UTC. **Orqaga qaytish nuqtasi shu.**
- Funksiyalar regioni: `iad1` (AQSh, Sharqiy). Production branch: `main`. Deployment Protection: Standard
  (`auforex.vercel.app` ochiq, Preview’lar Vercel login bilan himoyalangan).
- Production baza o‘zgaruvchilari **Preview uchun ham** amal qiladi: alohida bazasi bo‘lmagan har qanday boshqa
  branch Preview’i production bazasiga ulanadi (`claude/final-stabilization` da alohida test bazasi bor).
  Tavsiya: bu to‘rt o‘zgaruvchini faqat Production qilish va Preview’larga umumiy test bazasini berish (production
  sozlamasi — faqat ruxsatingiz bilan).

## 2. Production R2 (`auforex-media`)

| Tekshiruv | Natija |
|---|---|
| Bucket | `auforex-media`, joylashuv EEUR (Sharqiy Yevropa), Standard, 23.11.2026 da yaratilgan |
| Ommaviy kirish | r2.dev o‘chiq, custom domen yo‘q → fayllar faqat imzolangan havola orqali ✅ |
| CORS | `https://auforex.vercel.app` · GET/HEAD/PUT · barcha sarlavhalar · `ETag` ochiq · 1 soat ✅ (brauzerdan to‘g‘ridan-to‘g‘ri va multipart yuklash uchun yetarli) |
| Lifecycle | Chala multipart yuklashlar 7 kunda bekor qilinadi ✅ |
| Kalitlar turi | `S3_SESSION_TOKEN` yo‘q → R2 API tokenidan olingan **doimiy** kalitlar (token muddati “Forever” bo‘lsa va bekor qilinmasa ishlayveradi) |
| Kalitlar yaroqliligi | ⚠️ **Bu yerdan tasdiqlab bo‘lmaydi**: qiymatlar Sensitive (API ham qaytarmaydi), Cloudflare tokenining tokenlar ro‘yxatini o‘qishga huquqi yo‘q (403). Production’ning `/api/health` (`main`) kalitni sinamaydi |

**Jonli saytda topilgan holat (faqat o‘qish):**
- `https://auforex.vercel.app/api/health` → `status: ok`, 4 migratsiya, `database.pooled: true`, `storage.driver: s3`.
  Bu kalitlar **borligini** bildiradi, ishlashini emas.
- **Production bucket bo‘sh (0 ta fayl).** Bosh sahifadagi “Trading Noldan” kitobining muqovasi
  (`covers/f6be…webp`) bazada bor, lekin bucket’da yo‘q, shuning uchun jonli saytda rasm **404**.
  Ehtimoliy sabab: `main` dagi R2 HEAD xatosi (`Content-Length` yo‘qoladi → hajm 0 → yuklash rad etiladi/o‘chiriladi).
  PR #3 da bu tuzatilgan (`b0dd5d7`). Relizdan keyin: Super admin → Kitoblar → **“Fayllarni tekshirish”** → topilmagan
  muqova/PDF’larni qayta yuklang (Darslardagi videolar ham shunday tekshiriladi: dars sahifasida video o‘ynashi kerak).

**Kalitlarni tasdiqlash (biri yetarli):**
1. Cloudflare → R2 → **Manage API Tokens** → production uchun yaratilgan token: *Active*, *Object Read & Write*,
   bucket `auforex-media`, TTL *Forever* (1 daqiqa).
2. Deploy’dan keyin **Super admin → Sozlamalar → Tizim → “Omborni tekshirish”** → 5/5 ✓. Bu kalit, yozish/o‘qish/o‘chirish,
   CORS va multipart’ni haqiqiy production kalitlari bilan sinaydi (sinov fayli darhol o‘chiriladi).
   ✗ chiqsa → 7-bo‘lim (orqaga qaytarish).

Eslatma: PR #3 da S3 formati noto‘g‘ri bo‘lsa faqat fayl yuklash/ko‘rish ishlamaydi (aniq xabar bilan). Kirish va
ro‘yxatdan o‘tishga ta’sir qilmaydi. Faqat `S3_*` dan biri yo‘q bo‘lsa butun sayt 503 bo‘ladi, production’da esa beshtasi ham bor.

## 3. Email (SMTP) — hozircha keyinga qoldirilgan (egasining qarori, 27.11.2026)

Production’ga **`REQUIRE_EMAIL_VERIFICATION=false`** qo‘shiladi (tasdiq bilan, deploy bilan birga). Natija
(Preview’da xuddi shu sozlama bilan E2E sinalgan):

- ro‘yxatdan o‘tish email tasdiqlashsiz → darhol shaxsiy kabinet; kirish odatdagidek; eski hisoblar ham kiradi;
- “Parolni unutdingizmi?” sahifasi: **“Email orqali parolni tiklash vaqtincha mavjud emas”** + Telegram havolasi
  (forma ko‘rsatilmaydi); profilda “Tasdiqlanmagan” belgisi ko‘rsatilmaydi; emailni o‘zgartirish vaqtincha yopiq;
- SMTP kodi o‘chirilmagan: keyinchalik `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` qo‘shilib,
  `REQUIRE_EMAIL_VERIFICATION` olib tashlansa (yoki `true`), tasdiqlash va parol tiklash qaytadi.

Keyin ulash variantlari: **A)** Resend + o‘z domeningiz (DNS: SPF/MX `send.<domen>`, DKIM `resend._domainkey.<domen>`;
`SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_USER=resend`) — bepul 100 xat/kun; **B)** Gmail ilova paroli
(`smtp.gmail.com:465`, ~500 xat/kun).

Eslatma: email bo‘lmaganda parolini unutgan foydalanuvchini faqat administrator tiklay oladi — buning uchun panelda
tugma yo‘q (qo‘shilmadi: ortiqcha funksiya qo‘shilmasin degan ko‘rsatma).

## 4. Production bazasining zaxirasi (28.11.2026 tekshiruvi)

**Holat:**
- Production bazasi — Vercel integratsiyasi orqali yaratilgan Prisma Postgres (o‘zgaruvchilar 21.11.2026). U Vercel
  boshqaradigan alohida Prisma workspace’da. Mening tokenim faqat “Personal workspace”ni (test bazasi) ko‘radi, Vercel
  tokeni esa Storage’ga kira olmaydi. Shuning uchun production zaxiralari bu yerdan **tekshirib bo‘lmadi**.
- Prisma hujjati: avtomatik kunlik zaxira (snapshot) faqat **Starter/Pro (7 kun) va Business (30 kun)** tariflarida.
  **Free** tarifda zaxira yo‘q. Ko‘rinadigan workspace Free (`backupRetentionDays: 0`). Production workspace ham
  Free bo‘lsa, **hozir zaxira umuman yo‘q** deb hisoblang.
- Bu muhitdan `db.prisma.io:5432` ga ulanib bo‘lmaydi (faqat HTTPS), demak `pg_dump` ni men bu yerda bajara olmayman.

**Zaxira yaratish — xavfsiz usullar (production’ga yozilmaydi, ma’lumot o‘chirilmaydi):**

1. **`npm run db:backup` (tavsiya, bepul, o‘z kompyuteringizda).** Bazadan faqat o‘qiydi: jadvallarni sanaydi, `pg_dump`
   (izchil snapshot) qiladi, keyin faylni **vaqtinchalik** PostgreSQL’ga to‘liq tiklab, har jadvaldagi qatorlar
   sonini solishtiradi. Natija: `backups/auforex-<barmoq izi>-<vaqt>.dump` + `.json` hisobot (SHA-256 bilan).
   Barmoq izi production uchun `85bcf18c856b` bo‘lishi kerak. Test bazasida sinaldi: 24/24 jadval mos.
   Talab: Docker Desktop (`postgres:17` image avtomatik olinadi) **yoki** PostgreSQL 17 o‘rnatilgan (pg_dump,
   pg_restore, psql va lokal server, `RESTORE_TEST_URL`). Windows (PowerShell):
   ```powershell
   # Vercel → Storage → bazangiz → .env.local yorlig‘idagi DIRECT manzil (db.prisma.io, pooled emas)
   Set-Content .env.backup 'BACKUP_DATABASE_URL="postgres://…@db.prisma.io:5432/postgres?sslmode=require"'
   npm run db:backup
   ```
   Fayl va `.env.backup` repoga tushmaydi (`.gitignore`). Faylda shaxsiy ma’lumotlar va parol xeshlari bor:
   shifrlangan arxivda (masalan 7-Zip AES-256) va internetga ulanmagan joyda saqlang; `.env.backup` ni o‘chiring.
2. **Prisma avtomatik zaxiralari (pullik tarif).** Vercel → Storage → baza → **Open in Prisma Console** → workspace
   Settings → Billing: tarifni ko‘ring. Starter’ga o‘tilsa, kunlik snapshot’lar paydo bo‘ladi (faqat faollik bo‘lgan
   kunlari). Tiklanishini tekshirish: **Backups → Restore backup → Restore to a new database** (asl bazaga tegmaydi);
   nusxa Vercel’da ko‘rinmaydi, keyin `npx prisma postgres delete <id>` bilan o‘chiriladi. **“Restore to an existing
   database” ni ishlatmang** — u jonli bazani ustidan yozadi.

Deploy’dan oldin kamida 1-usul ✓ bo‘lishi shart (hisobotda “Zaxira yaroqli”).

## 5. Xavfsizlik ko‘rigi

| Tekshiruv | Holat |
|---|---|
| `npm audit --omit=dev` | ✅ 0. Avval 3 ta *high* topilgan edi: Prisma CLI ichidagi `effect` ReDoS, GHSA-7589-6fvf-x4pw, faqat build vaqtida ishlatiladi. `overrides` bilan `effect@3.22.5` ga yangilandi |
| PR diff’ida kalit/sir | ✅ topilmadi. `.env` repoda yo‘q |
| Protection Bypass for Automation | ✅ almashtirildi (27.11): 2 ta eski kalit bekor qilindi, 1 ta yangisi yaratildi. Eski cookie endi rad etiladi (302) |
| Auth | ✅ cross-site 403, IP bo‘yicha cheklovlar, tasdiqlash, parol tiklanganda boshqa sessiyalar yopiladi, admin sahifalari oddiy foydalanuvchiga 404 (E2E 39/39) |
| Sarlavhalar | ✅ CSP (nonce), HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP |
| Fayllar | ✅ private bucket, 3 soatlik imzolangan havolalar, CORS faqat sayt manziliga, fayl turi mazmunidan tekshiriladi |
| Preview ↔ production bazasi | ⚠️ boshqa branch Preview’lari production bazasiga ulanadi (1-bo‘lim) |
| Birinchi so‘rov kechikishi | ⚠️ uzoq turib qolgandan keyingi birinchi so‘rov 16–30+ s (Preview’da yangi deploydan keyin ro‘yxatdan o‘tish 30 s dan oshdi, production `/api/health` birinchi marta 30 s da javob bermadi, keyin 0,1–0,6 s). Funksiya + baza “sovuq start”i. Tavsiya: baza regionini funksiyalar regioni (`iad1`) bilan moslash, kerak bo‘lsa har 5 daqiqada `/api/health` ni chaqiradigan monitoring (masalan UptimeRobot) |
| `TRUSTED_ORIGINS` (production) | ℹ️ qiymati yashirin. Unda faqat o‘z manzillaringiz borligini Vercel’da tekshiring |
| Vercel API tokeni | ℹ️ 7 kunlik, faqat shu jamoa uchun. Relizdan keyin Vercel → Account → Tokens da o‘chiring |

## 6. Reliz tartibi (har bosqich alohida tasdiq bilan)

1. **Zaxira** (4-bo‘lim): `pg_dump` yoki Prisma Console → Backups’da kunlik zaxira borligini tasdiqlash.
2. **Production sozlamasi** (**tasdiq 1 — berildi, 28.11 bajarildi**): `REQUIRE_EMAIL_VERIFICATION=false` (faqat Production,
   keyingi deploy’dan kuchga kiradi). SMTP qo‘shilmaydi.
3. **Birlashtirish va deploy** (**tasdiq 2**). Eng xavfsiz yo‘l — **ikki bosqichli**: Vercel → Settings → Environments →
   Production’da “Auto-assign custom production domains” vaqtincha o‘chiriladi; PR #3 `main` ga birlashtiriladi; yangi
   production deploy production sozlamalari bilan quriladi, lekin `auforex.vercel.app` **eski versiyada qoladi**.
   Men deploy’ning o‘z manzilida tekshiraman (health, kirish, **Tizim → Omborni tekshirish** — production R2 kalitlari
   shu yerda haqiqiy yozish/o‘qish bilan tasdiqlanadi). Hammasi ✓ bo‘lsa → **Promote to Production** (bir lahzada),
   ✗ bo‘lsa sayt umuman o‘zgarmaydi. Build: `prisma migrate deploy` → “No pending migrations”.
   (Sozlama `auforex.vercel.app` ni ham ushlab turishini o‘chirishdan oldin tekshiramiz; aks holda xuddi shu ishni
   `vercel deploy --prod --skip-domain` qiladi.)
4. **Tekshiruv** (men, darhol): `/api/health` → `status: ok`, `storage.uploads: ok`, `mail.configured: false`,
   `verificationRequired: false`; xavfsizlik sarlavhalari; noto‘g‘ri parolga 401, begona saytdan so‘rovga 403; bosh sahifa,
   darslar, kitoblar, parolni tiklash sahifasidagi xabar, telefon ko‘rinishi.
5. **Import hisobi** (**tasdiq 3**): men production’da `content-import@example.com` hisobini ochaman (parol faqat menda,
   hech qayerga chiqmaydi), siz uni **Super admin → Jamoa** da super admin qilasiz. Shu hisob bilan:
   - **Tizim → “Omborni tekshirish”** — production R2 kalitlari haqiqiy yozish/o‘qish/o‘chirish bilan tekshiriladi (5/5);
   - Kitoblar → **“Fayllarni tekshirish”** (“Trading Noldan” muqovasi).
6. **Kontent** (**tasdiq 4**): ZIP → `PLAN.md` (kategoriyalar, tartib, Bepul/PRO) → siz tasdiqlaysiz → `prepare` → `import`
   → `verify` (har dars bitta, video 206) → siz saytda ko‘rasiz → **tasdiq 5** → `publish` (kurslar nashr qilinadi).
7. Ish tugagach import hisobi super admin’dan chiqariladi va bloklanadi (Super admin → Foydalanuvchilar).
8. Biror ✗ bo‘lsa → darhol 7-bo‘lim.

## 7. Orqaga qaytarish (1 daqiqa)

1. **Vercel → Deployments → `dpl_5kiP8bxeumX7yJgCytGZqqfnFwmL` (68a3601) → ⋯ → Instant Rollback.**
   Ruxsatingiz bilan men ham API orqali qila olaman: `POST /v1/projects/prj_wTcQxhULuSBomtoo3jiULsCmfqkD/rollback/dpl_5kiP8bxeumX7yJgCytGZqqfnFwmL`.
   Rollback’dan keyin Vercel `main` ning yangi deploy’larini production domeniga avtomatik ulamaydi. Tuzatilgan versiyani
   **Promote to Production** bilan qaytarasiz.
2. **Baza:** migratsiya yo‘q, sxema bir xil, shuning uchun eski versiya yangi versiya yozgan ma’lumot bilan ishlayveradi. Bazani tiklash kerak emas.
   Ma’lumot buzilgan holatdagina zaxira **yangi** bazaga tiklanadi (`pg_restore --no-owner -d "<yangi baza URL>" fayl.dump`)
   va `DATABASE_URL` almashtiriladi. Jonli baza ustiga hech qachon tiklanmaydi.
3. **O‘zgaruvchilar:** `REQUIRE_EMAIL_VERIFICATION=false` qolishi mumkin (`main` SMTP’siz baribir tasdiqlashni o‘chiradi).
4. **Kod:** `git revert -m 1 <merge commit>` → PR → `main`.

## 8. Videolarni ommaviy import qilish (production’ga — faqat kontent tasdiqlangandan keyin)

Asosiy yo‘l: **`npm run content:import`** (ZIP → reja → Super admin panel orqali yuklash). Production bazasi yoki R2
kalitlari kerak emas: video saytning o‘z kalitlari bilan R2’ga, ma’lumot saytning o‘z formalaridan bazaga yoziladi.
Takror darslar yaratilmaydi (bir xil fayl, shu kursdagi shu nom yoki raqam o‘tkazib yuboriladi). Preview’da sinalgan:
batafsil [VIDEO-DARSLAR.md → ZIP arxivdan saytga](VIDEO-DARSLAR.md).

Muqobil: `npm run videos:import -- "<papka>" --to r2` — sizning kompyuteringizdan, `.env.import` da production
`DATABASE_URL` va R2 kalitlari bilan (reja baza barmoq izi va bucket nomini ko‘rsatadi, `--yes` bilan yuklaydi).

Production’ga import faqat siz ZIP’ni berib, rejani tasdiqlaganingizdan keyin bo‘ladi.
