# Production reliz: holat, to‘siqlar va reja (27.11.2026)

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

**Kalitlarni tasdiqlash (biri yetarli):**
1. Cloudflare → R2 → **Manage API Tokens** → production uchun yaratilgan token: *Active*, *Object Read & Write*,
   bucket `auforex-media`, TTL *Forever* (1 daqiqa).
2. Deploy’dan keyin **Super admin → Sozlamalar → Tizim → “Omborni tekshirish”** → 5/5 ✓. Bu kalit, yozish/o‘qish/o‘chirish,
   CORS va multipart’ni haqiqiy production kalitlari bilan sinaydi (sinov fayli darhol o‘chiriladi).
   ✗ chiqsa → 7-bo‘lim (orqaga qaytarish).

Eslatma: PR #3 da S3 formati noto‘g‘ri bo‘lsa faqat fayl yuklash/ko‘rish ishlamaydi (aniq xabar bilan). Kirish va
ro‘yxatdan o‘tishga ta’sir qilmaydi. Faqat `S3_*` dan biri yo‘q bo‘lsa butun sayt 503 bo‘ladi, production’da esa beshtasi ham bor.

## 3. Production SMTP (asosiy to‘siq)

PR #3 production’da email tasdiqlashni majburiy qiladi. SMTP bo‘lmasa yangi ro‘yxatdan o‘tish “Pochta xizmati
sozlanmagan” xatosi bilan to‘xtaydi, parol tiklash ham ishlamaydi. Resend hisobida hozir **birorta domen yo‘q**.
`auforex.vercel.app` ga DNS yozuvi qo‘shib bo‘lmaydi, shuning uchun ikki yo‘l bor:

**A) Resend + o‘z domeningiz (tavsiya: eng yaxshi yetkazish, `no-reply@<domen>`)**
1. Domen nomini menga yozasiz (masalan `auforex.uz`).
2. Men Resend API orqali domenni qo‘shaman va DNS yozuvlarini beraman: SPF (TXT) va MX `send.<domen>` uchun,
   DKIM (TXT) `resend._domainkey.<domen>` uchun.
3. Siz ularni domen provayderida qo‘shasiz (5–10 daqiqa).
4. Men domenni tasdiqlayman. Keyin faqat shu domendan yuborishga ruxsatli kalit yaratib, **ruxsatingiz bilan** Production’ga
   `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_USER=resend`, `SMTP_PASSWORD`, `MAIL_FROM` ni qo‘yaman
   (Sensitive). Qiymatlar ko‘rsatilmaydi.
   Resend bepul tarifi: kuniga 100, oyiga 3 000 xat.

**B) Gmail (domen bo‘lmasa)**
1. Google hisobida 2 bosqichli himoyani yoqing, so‘ng `myaccount.google.com/apppasswords` da “AU Forex” uchun 16 belgili parol yarating.
2. Vercel → Settings → Environment Variables → **faqat Production**, *Sensitive*:
   `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=<gmail manzil>`, `SMTP_PASSWORD=<ilova paroli>`,
   `MAIL_FROM=AU Forex Academy <shu gmail manzil>`. Parolni o‘zingiz kiritasiz, u menga ham ko‘rinmaydi.
   Gmail limiti: kuniga taxminan 500 xat.

**Mavjud foydalanuvchilar.** `main` da tasdiqlash o‘chiq edi, shuning uchun hozirgi hisoblarning emaili “tasdiqlanmagan”.
Relizdan keyin ular kirganda “Email manzilingiz hali tasdiqlanmagan” va **“Tasdiqlash xatini qayta yuborish”**
tugmasini ko‘radi (E2E sinalgan). Xat yetib bormasa: Super admin → Foydalanuvchilar → hisob →
**“Emailni qo‘lda tasdiqlash”** (yangi, audit logga yoziladi, E2E sinalgan).
Hamma eski hisoblarni birdan “tasdiqlangan” qilish mumkin, lekin bu production ma’lumotini o‘zgartiradi va xavfsizlik
jihatidan yomonroq (begona email bilan ochilgan hisob ham tasdiqlanib qoladi). Faqat alohida ruxsat va zaxiradan keyin.

## 4. Production bazasining zaxirasi

- Production baza: Vercel orqali ulangan Prisma Postgres (o‘zgaruvchilar 21.11.2026 da yaratilgan). U menga ko‘rinadigan
  Prisma workspace’da emas, shuning uchun avtomatik zaxiralarini bu yerdan tekshirib bo‘lmadi.
- Ko‘rinadigan workspace bepul tarifda: test bazasida `backupRetentionDays: 0`, ya’ni **avtomatik zaxira yo‘q**.
  Production uchun ham shunday deb hisoblang, toki boshqasi tasdiqlanmaguncha.
- **Birlashtirishdan oldin qo‘lda zaxira shart.** Kompyuteringizda Docker bilan:

  ```bash
  # Vercel → Storage → bazangiz → .env.local yorlig‘idagi DATABASE_URL (db.prisma.io bilan, pooled emas)
  docker run --rm postgres:18 pg_dump -Fc "postgres://…@db.prisma.io:5432/postgres?sslmode=require" > auforex-prod-2026-11-27.dump
  docker run --rm -v "%cd%:/b" postgres:18 pg_restore --list /b/auforex-prod-2026-11-27.dump
  ```

  Ikkinchi buyruq jadvallar ro‘yxatini chiqarsa (`TABLE DATA public user` va boshqalar), zaxira yaroqli.
  Faylda shaxsiy ma’lumotlar va parol xeshlari bor: uni shifrlangan joyda saqlang, hech kimga yubormang.
- Yoki: Vercel → Storage → baza → **Open in Prisma Console → Backups**. U yerda kunlik zaxiralar ko‘rinsa, qo‘lda zaxira ixtiyoriy.
- PR #3 da **migratsiya yo‘q** (4 ta migratsiya production’da allaqachon qo‘llangan). Production build’dagi
  `prisma migrate deploy` “No pending migrations” deb tugaydi va bazaga tegmaydi.

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
| `TRUSTED_ORIGINS` (production) | ℹ️ qiymati yashirin. Unda faqat o‘z manzillaringiz borligini Vercel’da tekshiring |
| Vercel API tokeni | ℹ️ 7 kunlik, faqat shu jamoa uchun. Relizdan keyin Vercel → Account → Tokens da o‘chiring |

## 6. Reliz tartibi (har bosqich alohida tasdiq bilan)

1. **Zaxira** (4-bo‘lim): siz qilasiz yoki Prisma Console’da kunlik zaxira borligini tasdiqlaysiz.
2. **SMTP** (3-bo‘lim, A yoki B): domen tasdiqlanadi/parol kiritiladi → Production’ga `SMTP_*` + `MAIL_FROM` (**tasdiq 1**).
3. **R2 kaliti** (2-bo‘lim): Cloudflare’da token holatini tasdiqlaysiz yoki 5-qadamdagi tekshiruvni shart qilib qo‘yamiz.
4. **Birlashtirish** (**tasdiq 2**): PR #3 Draft’dan chiqariladi va `main` ga birlashtiriladi. Vercel production build’ni o‘zi boshlaydi.
5. **Tekshiruv** (men, darhol):
   - `/api/health`: `status: ok`, `storage.uploads: ok`, `mail.configured: true`, `verificationRequired: true`;
   - xavfsizlik sarlavhalari; noto‘g‘ri parolga 401, begona saytdan so‘rovga 403;
   - bosh sahifa, darslar, kitoblar, telefon ko‘rinishi;
   - ruxsatingiz bilan bitta sinov hisobi: ro‘yxatdan o‘tish → tasdiqlash xati → kabinet, parol tiklash.

   Siz: Super admin → Tizim → “Omborni tekshirish” (5/5) va “Menga test xat yuborish”; bitta video va bitta kitob oching.
6. Biror ✗ bo‘lsa → darhol 7-bo‘lim.

## 7. Orqaga qaytarish (1 daqiqa)

1. **Vercel → Deployments → `dpl_5kiP8bxeumX7yJgCytGZqqfnFwmL` (68a3601) → ⋯ → Instant Rollback.**
   Ruxsatingiz bilan men ham API orqali qila olaman: `POST /v1/projects/prj_wTcQxhULuSBomtoo3jiULsCmfqkD/rollback/dpl_5kiP8bxeumX7yJgCytGZqqfnFwmL`.
   Rollback’dan keyin Vercel `main` ning yangi deploy’larini production domeniga avtomatik ulamaydi. Tuzatilgan versiyani
   **Promote to Production** bilan qaytarasiz.
2. **Baza:** migratsiya yo‘q, sxema bir xil, shuning uchun eski versiya yangi versiya yozgan ma’lumot bilan ishlayveradi. Bazani tiklash kerak emas.
   Ma’lumot buzilgan holatdagina zaxira **yangi** bazaga tiklanadi (`pg_restore --no-owner -d "<yangi baza URL>" fayl.dump`)
   va `DATABASE_URL` almashtiriladi. Jonli baza ustiga hech qachon tiklanmaydi.
3. **O‘zgaruvchilar:** qo‘shilgan `SMTP_*` qolishi mumkin (`main` ham SMTP bilan ishlaydi, unda tasdiqlash yoqiladi) yoki o‘chiriladi.
4. **Kod:** `git revert -m 1 <merge commit>` → PR → `main`.

## 8. Videolarni ommaviy import qilish (production’ga — faqat kontent tasdiqlangandan keyin)

Tayyor: `npm run videos:import -- "<papka>" --to r2`. Avval **faqat reja** ko‘rsatiladi: baza barmoq izi, bucket nomi,
kurslar, darslar, hajm, o‘tkazib yuboriladigan formatlar. `--yes` qo‘shilgandagina yuklanadi. Yangi kurslar nashr qilinmagan
holda yaratiladi. `.env.import` (kompyuteringizda, hech kimga bermang) uchun kerak:

- `DATABASE_URL`: production bazasi (Vercel → Storage → `.env.local`);
- `S3_ENDPOINT`, `S3_BUCKET=auforex-media`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`: production R2 tokeni.

Reja chiqqanda barmoq izi production build logidagi “Baza barmoq izi” bilan bir xil bo‘lsin. Batafsil:
[VIDEO-DARSLAR.md](VIDEO-DARSLAR.md). Production’ga import faqat siz kontentni berib, tasdiqlaganingizdan keyin bo‘ladi.
