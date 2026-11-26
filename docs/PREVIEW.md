# Preview’ni alohida test resurslari bilan sozlash

Preview — `main` dan boshqa branch’ning Vercel’dagi nusxasi. U production ma’lumotlariga **tegmasligi** kerak:
alohida baza, alohida R2 bucket, alohida pochta sozlamasi.

Shu branch uchun qiymatlar:

| | |
|---|---|
| Branch | `claude/final-stabilization` |
| Preview manzili | `https://auforex-git-claude-final-st-eddf8f-hamidullos-projects-d86a2122.vercel.app` |
| Himoya | Vercel Authentication — faqat Vercel hisobingizga kirgan holda ochiladi |

## Hozirgi holat (Vercel API orqali tekshirildi, 26.11.2026)

| O‘zgaruvchi | Production | Preview | Xulosa |
|---|---|---|---|
| `DATABASE_URL`, `DATABASE_URL_POOLED` | ✓ | ✓ **(xuddi shu yozuv)** | ⚠️ Preview **production bazasiga** ulangan |
| `BETTER_AUTH_SECRET` | ✓ | ✓ (alohida) | ✓ |
| `S3_*` | ✓ | — | Preview’da yuklash o‘chiq |
| `SMTP_*`, `MAIL_FROM` | — | — | ⚠️ Hech qayerda pochta yo‘q |
| `NEXT_PUBLIC_APP_URL` | ✓ | — | ✓ Preview o‘z manzilini avtomatik oladi |

Preview build migratsiya va seed ishlatmaydi, ya’ni deploy bazani o‘zgartirmaydi. Lekin Preview **saytida** ro‘yxatdan
o‘tish yoki yuklash ma’lumotni production bazasiga yozadi. Shuning uchun 1-qadam bajarilmaguncha Preview’da **faqat
ko‘rib chiqing**: ro‘yxatdan o‘tmang, kontent qo‘shmang.

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

   **Sensitive** belgisini yoqing. Mavjud umumiy `DATABASE_URL` yozuviga **tegmang** — u production uchun.
   `DATABASE_URL_POOLED` ham shart: ilova avval shuni o‘qiydi, bo‘lmasa umumiy (production) qiymat ishlatiladi.
3. Shu ikkala yozuv paydo bo‘lgach (Claude ularni API orqali tekshiradi), test bazasida jadvallar va boshlang‘ich
   ma’lumotlar yaratilishi uchun **shu branch’ga** qo‘shiladi:
   `MIGRATE_ON_BUILD=true`, `SEED_ON_BUILD=true` va test uchun `FOUNDER_PASSWORD` (12+ belgi, harf va raqam).
   ⚠️ Bularni 2-qadamdan **oldin** qo‘shmang: aks holda seed production bazasida ishlaydi.

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
2. Build logida: `Migratsiyalarni qo‘llash …` va seed qatorlari — bu safar **test bazasida**.
3. Brauzerda (Vercel’ga kirgan holda) `…/api/health`: `status: ok`, `storage.driver: s3`, `uploads: ok`,
   `mail.configured: true`.
4. `asadbek` + test `FOUNDER_PASSWORD` bilan kiring → **Super admin → Sozlamalar → Tizim**:
   “Omborni tekshirish” (5 ✓) va “Menga test xat yuborish”.
5. [RELIZ.md](RELIZ.md) 4-bo‘limidagi qolgan tekshiruvlar (ro‘yxatdan o‘tish, parol tiklash, video, kitob).

Production’ga ulangan yozuvlar (umumiy `DATABASE_URL`, production `S3_*`) bu jarayonda o‘zgartirilmaydi.
