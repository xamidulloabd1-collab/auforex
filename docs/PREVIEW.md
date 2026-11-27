# Preview’ni alohida test resurslari bilan sozlash

Preview — `main` dan boshqa branch’ning Vercel’dagi nusxasi. U production ma’lumotlariga **tegmasligi** kerak:
alohida baza, alohida R2 bucket, alohida pochta sozlamasi.

Shu branch uchun qiymatlar:

| | |
|---|---|
| Branch | `claude/final-stabilization` |
| Preview manzili | `https://auforex-git-claude-final-st-eddf8f-hamidullos-projects-d86a2122.vercel.app` |
| Himoya | Vercel Authentication — faqat Vercel hisobingizga kirgan holda ochiladi |

## Hozirgi holat (27.11.2026, API orqali sozlangan va tekshirilgan)

Shu branch uchun barcha qiymatlar Vercel’da **faqat Preview + `claude/final-stabilization`** doirasida; Production
yozuvlariga tegilmagan.

| Resurs | Holat |
|---|---|
| Baza | Prisma `auforex-preview` (`us-east-1`), alohida ulanish. Preview build barmoq izi `443e410d3d96` (production `85bcf18c856b`), migratsiyalar hali qo‘llanmagan — bo‘sh, alohida baza ✓ |
| `DATABASE_URL`, `DATABASE_URL_POOLED`, `FOUNDER_PASSWORD` | ✓ (parol Vercel’da ko‘rinadigan turda — Preview’ga `asadbek` bilan kirish uchun) |
| R2 | `auforex-media-preview`, private, CORS faqat Preview manziliga, chala multipart 1 kunda bekor ✓ · `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION` ✓ |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | ⏳ egasi kiritadi (pastda 2-bo‘lim, 4-qadam) |
| SMTP | Resend test rejimi: `smtp.resend.com:465`, faqat yuborishga ruxsatli kalit, `onboarding@resend.dev` ✓ |
| Migratsiya + seed | ⏳ egasining ruxsatidan keyin (`PREVIEW_DB_FINGERPRINT=443e410d3d96`) |

Resend test rejimida xatlar faqat Resend test manzillariga (`delivered+…@resend.dev`) va Resend hisobi egasiga yetadi —
Preview sinovlari uchun aynan shu kerak; boshqa manzillarga xat ketmaydi.

Quyidagi qo‘lda bajariladigan qadamlar yuqoridagilar avtomatik bajarilmagan holat uchun qoldirilgan.

## 1. Alohida test bazasi (eng muhim)

Production yozuvlariga tegmaymiz: shu branch uchun **ustidan yoziladigan** (branch-scoped) qiymatlar qo‘shamiz.
Vercel’da bitta branch uchun berilgan qiymat umumiy Preview qiymatidan ustun turadi.

1. **console.prisma.io** → loyihangiz → **New database** → nom: `auforex-preview` → yarating →
   **Connect** → `postgres://…@db.prisma.io:5432/…` ko‘rinishidagi to‘g‘ridan-to‘g‘ri manzilni nusxalang.
   (Neon yoki Supabase’dagi bepul Postgres ham bo‘ladi.)
2. Vercel → auforex → **Settings → Environment Variables → Add New**:

   | Key | Value | Environments | Branch |
   |---|---|---|---|
   | `DATABASE_URL` | 1-qadamdagi test manzil | faqat **Preview** | `claude/final-stabilization` |
   | `DATABASE_URL_POOLED` | xuddi shu manzil, host `pooled.db.prisma.io` (Neon/Supabase’da — xuddi shu manzil) | faqat **Preview** | `claude/final-stabilization` |

   | `FOUNDER_PASSWORD` | test bazasidagi `asadbek` uchun yangi parol (12+ belgi, harf va raqam) | faqat **Preview** | `claude/final-stabilization` |

   **Sensitive** belgisini yoqing. Mavjud umumiy `DATABASE_URL` yozuviga **tegmang** — u production uchun.
   `DATABASE_URL_POOLED` ham shart: ilova avval shuni o‘qiydi. Ikkalasi turli bazaga qarasa, Preview build to‘xtaydi
   va sayt bazaga umuman ulanmaydi (kodda himoya bor).
3. **Izolyatsiyani tekshirish (Claude, Vercel API orqali, faqat o‘qish).** Har bir Preview build’i logida bazaning
   *barmoq izi* (manzil/parolsiz 12 belgilik xesh) va `prisma migrate status` (faqat o‘qish) chiqadi. Test bazasi
   ulanganda barmoq izi production’nikidan farq qiladi va migratsiyalar “qo‘llanmagan” bo‘ladi — bu bazaning bo‘sh va
   alohida ekanini isbotlaydi.
4. Shundan keyingina, faqat shu branch uchun, `PREVIEW_DB_FINGERPRINT=<test bazasi barmoq izi>`,
   `MIGRATE_ON_BUILD=true`, `SEED_ON_BUILD=true` qo‘shiladi va Preview qayta deploy qilinadi. Build migratsiya/seed’ni
   **faqat barmoq izi mos kelsa** bajaradi — boshqa bazaga (masalan production’ga) ulansa, build to‘xtaydi.
   Seed Vercel’da parolni hech qachon logga chiqarmaydi: `FOUNDER_PASSWORD` siz asoschi hisobi yaratilmaydi.

## 2. Alohida R2 bucket

1. Cloudflare → R2 → **Create bucket** → `auforex-media-preview` (Public access o‘chiq).
2. Bucket → Settings → **CORS Policy**:

   ```json
   [
     {
       "AllowedOrigins": ["https://auforex-git-claude-final-st-eddf8f-hamidullos-projects-d86a2122.vercel.app"],
       "AllowedMethods": ["GET", "PUT", "HEAD"],
       "AllowedHeaders": ["Content-Type", "Range"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

3. **Manage API tokens → Create API token** → Object Read & Write → faqat `auforex-media-preview`.
4. Vercel’da `S3_ENDPOINT`, `S3_BUCKET` (`auforex-media-preview`), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
   `S3_REGION` (`auto`) — faqat **Preview**, branch `claude/final-stabilization`. Production kalitlarini ishlatmang.

## 3. Pochta (SMTP)

[EMAIL.md](EMAIL.md) dagi provayderlardan biri. Preview uchun shu branch’ga: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASSWORD`, `MAIL_FROM` (`SMTP_SECURE` bo‘sh). Sinov xatlarini faqat o‘z pochta qutingizga yuboring.

## 4. Qayta deploy va tekshirish

1. Vercel → Deployments → shu branch’ning oxirgi deploy’i → **⋯ → Redeploy** (yoki branch’ga yangi commit).
2. Build logida: `Preview test bazasi tasdiqlangan (fingerprint mos)`, so‘ng `Migratsiyalarni qo‘llash …` va seed
   qatorlari — **test bazasida**.
3. Brauzerda (Vercel’ga kirgan holda) `…/api/health`: `status: ok`, `storage.driver: s3`, `uploads: ok`,
   `mail.configured: true`.
4. `asadbek` + test `FOUNDER_PASSWORD` bilan kiring → **Super admin → Sozlamalar → Tizim**:
   “Omborni tekshirish” (5 ✓) va “Menga test xat yuborish”.
5. [RELIZ.md](RELIZ.md) 4-bo‘limidagi qolgan tekshiruvlar (ro‘yxatdan o‘tish, parol tiklash, video, kitob).

Production’ga ulangan yozuvlar (umumiy `DATABASE_URL`, production `S3_*`) bu jarayonda o‘zgartirilmaydi.
