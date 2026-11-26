# Reliz: yakuniy barqarorlashtirish (branch `claude/final-stabilization`)

Asos: `9a5fcdc` (fix: harden R2 and email failure handling). Bu reliz **bazaga o‘zgartirish kiritmaydi** —
yangi migratsiya yo‘q, `prisma/` papkasi o‘zgarmagan. Mavjud foydalanuvchilar, darslar, kitoblar va progress tegilmaydi.

> `main` ga birlashtirish va production’ga deploy qilish **faqat sizning tasdig‘ingiz bilan**. Quyidagi qadamlar shu
> tasdiqdan keyin bajariladi.

## 1. Nima o‘zgardi

### Fayl ombori (Cloudflare R2)
- `S3_ENDPOINT` tekshiruvi qayta yozildi: R2 va boshqa S3-mos omborlar (AWS S3, B2, MinIO) qabul qilinadi; ko‘p
  uchraydigan xatolar aniq xabar bilan rad etiladi (r2.dev ommaviy manzili, `http://`, ortiqcha yo‘l, noto‘g‘ri bucket nomi).
  Cloudflare ko‘rsatgandek oxirida `/<bucket>` bilan kiritilgan manzil ham qabul qilinadi.
- Noto‘g‘ri S3 sozlamasi endi `/api/health` da **“baza ishlamayapti” deb noto‘g‘ri ko‘rsatilmaydi**:
  `storage.uploads: "config_invalid"` va sababi chiqadi.
- R2 so‘rovlariga 20 soniyalik javob kutish chegarasi va qayta urinish (GET/HEAD/PUT/DELETE — 3 marta) qo‘shildi:
  osilib qolgan ulanish Vercel funksiyasini to‘xtatib qo‘ymaydi. POST (multipart boshlash/yakunlash) takrorlanmaydi.
- Katta videolar endi **4 bo‘lakdan parallel** yuklanadi (avval bittadan); 60 soniya hech narsa yubormagan bo‘lak
  “uzilgan” deb qayta yuboriladi; bitta bo‘lak butunlay yiqilsa qolganlari darhol to‘xtatiladi va R2’dagi chala
  yuklash bekor qilinadi.
- Yangi: **Super admin → Sozlamalar → Tizim → “Omborni tekshirish”** va `npm run storage:check` — haqiqiy kalitlar bilan
  yozish/o‘qish/o‘chirish, sayt manzilidan CORS preflight, ETag ko‘rinishi va multipart’ni tekshiradi.

### Email (SMTP)
- **Xato tuzatildi:** `SMTP_SECURE` bo‘sh qoldirilganda 465-port uchun TLS yoqilmas edi (ulanish osilib qolardi).
  Endi bo‘sh qiymat = avtomatik (465 → TLS, 587 → STARTTLS).
- SMTP ulanishiga 10/10/20 soniyalik chegaralar qo‘shildi (avval 2–10 daqiqa kutishi mumkin edi).
- Xat yuborilmasa foydalanuvchi aniq xabar oladi (“Pochta xizmati vaqtincha ishlamayapti…”), logga esa sabab yoziladi
  (`[mail] … yuborilmadi: SMTP login yoki parol qabul qilinmadi` va h.k.). Xat matni va havolalar logga yozilmaydi.
- Email o‘zgartirishda tasdiqlash xati ketmasa, eski email saqlanadi va aniq xabar chiqadi.
- “Email tasdiqlandi” sahifasi endi hisobning **haqiqiy holatini** ko‘rsatadi (to‘g‘ridan-to‘g‘ri ochilganda yolg‘on
  “tasdiqlandi” demaydi).
- Yangi: **“Menga test xat yuborish”** (Tizim bo‘limi) va `npm run mail:check`.

### Boshqa tuzatishlar
- Avatar o‘chirilganda fayl ombordan ham o‘chiriladi (avval qolib ketardi).
- PRO’si yo‘q foydalanuvchiga “PRO bekor qilish” endi xato beradi (holat buzilmaydi).
- Server amallarida R2 xatolari “Kutilmagan xatolik” emas, aniq sabab bilan qaytadi.
- Avatar va challenge rasmi chegarasi 4 MB ga tushirildi — Vercel bitta so‘rovda 4,5 MB dan ortig‘ini qabul qilmaydi,
  avval 4,5–5 MB rasm tushunarsiz xato berardi.
- Login’dan keyingi qaytish manzili (`?next=`) brauzer hiylalariga qarshi mustahkamlandi (`/\t/evil.com` kabi).
- Dars sahifasi: 4 ta ketma-ket baza so‘rovi parallel bajariladi.
- ESLint ogohlantirishlari 5 tadan 0 ga tushdi (React Hook Form `watch` → `useWatch`).
- `npm run doctor` R2 manzili formatini va SMTP holatini ham tekshiradi.

## 2. Production’ga chiqarish (tasdiqdan keyin)

1. **Zaxira** (baza o‘zgarmasa ham tavsiya etiladi): [VERCEL.md](VERCEL.md) → “zaxira nusxa” bo‘limidagi `pg_dump` buyrug‘i.
2. **GitHub**: `claude/final-stabilization` → `main` ga Pull Request oching, o‘zgarishlarni ko‘rib chiqing va birlashtiring.
   Vercel `main` dan Production deploy’ni o‘zi boshlaydi.
3. **Vercel → Settings → Environment Variables** (Production). Majburiylari:

   | Nom | Qayerdan |
   |---|---|
   | `DATABASE_URL` | Prisma Postgres ulanganda Vercel o‘zi qo‘yadi |
   | `BETTER_AUTH_SECRET` | Mavjud qiymat — **o‘zgartirmang** |
   | `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL` | `https://auforex.vercel.app` yoki o‘z domeningiz |
   | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Cloudflare R2 — [FAYL-SAQLASH.md](FAYL-SAQLASH.md) (bucket CORS’i ham shart) |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | Email provayderi — [EMAIL.md](EMAIL.md). `SMTP_SECURE` ni bo‘sh qoldiring |

   Tavsiya: `DATABASE_URL_POOLED` (host `pooled.db.prisma.io`) — bo‘lmasa ham Vercel’da avtomatik tanlanadi.
4. O‘zgaruvchi qo‘shilgan/o‘zgargan bo‘lsa: **Deployments → oxirgi deploy → ⋯ → Redeploy**.

## 3. Deploy’dan keyin tekshirish (10 daqiqa)

1. `https://<sayt>/api/health` →
   `"status":"ok"`, `"database":{"pooled":true,"poolMax":2}`, `"storage":{"driver":"s3","uploads":"ok"}`,
   `"mail":{"configured":true,"verificationRequired":true}`.
2. **Super admin → Sozlamalar → Tizim**:
   - “Omborni tekshirish” → 5 ta ✓ (✗ bo‘lsa yonida nimani tuzatish yozilgan);
   - “Menga test xat yuborish” → xat keladi (Spam’ni ham tekshiring).
3. Yangi email bilan ro‘yxatdan o‘ting → xatdagi havola → “Email tasdiqlandi” → kabinet ochiladi.
4. “Parolni unutdingizmi?” → xat → yangi parol → shu parol bilan kirish.
5. Super admin → Darslar → yangi dars → 15–50 MB video yuklang (foiz 100% gacha) → saqlang → dars sahifasida o‘ynasin.
6. Kitoblar → kitob oching (sahifalar ko‘rinsin); telefonda ham bitta dars va bitta kitobni oching.

## 4. Orqaga qaytarish (muammo chiqsa)

Vercel → **Deployments** → oldingi ishlagan deploy → **⋯ → Instant Rollback** (yoki “Promote to Production”).
Bu relizda migratsiya yo‘q, shuning uchun bazani tiklash shart emas.

## 5. Sinov natijalari

To‘liq jadval: [TEST_RESULTS.md](TEST_RESULTS.md). Qisqacha: TypeScript ✓, ESLint 0 xato / 0 ogohlantirish,
unit testlar, production build, va E2E uch rejimda — lokal disk, Vercel rejimi + CORS’ni tekshiradigan S3 emulyatori,
haqiqiy SMTP serveri (email tasdiqlash va parol tiklash).

**Sinalmagan (bu muhitdan kirish yo‘q):** haqiqiy Cloudflare R2 bucket, haqiqiy email provayderi, jonli
auforex.vercel.app. Shu sababli bu reliz “production’ga tayyor” deb faqat 3-bo‘limdagi tekshiruvlar
haqiqiy kalitlar bilan ✓ bo‘lgandan keyin hisoblanadi.
