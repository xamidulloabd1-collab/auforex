# Fayllarni saqlash: Cloudflare R2 (Vercel uchun majburiy)

Vercel’da sayt **faqat o‘qiladigan** diskdan ishlaydi va bitta so‘rov **4,5 MB** dan katta bo‘lolmaydi.
Shuning uchun video, kitob, muqova va asoschi rasmi saytning o‘z diskiga emas, alohida **obyekt omboriga** saqlanadi.
Sayt S3 protokolini tushunadigan har qanday omborda ishlaydi; quyida eng arzon va qulayi — **Cloudflare R2** (chiqish
trafigi bepul, 10 GB gacha bepul).

| Nima | Qanday yuklanadi | Kim ko‘radi |
|---|---|---|
| Video dars | Brauzerdan **to‘g‘ridan-to‘g‘ri** omborga (10 MB bo‘laklab, bir vaqtda 4 bo‘lak; uzilsa yoki 60 s “qotib” qolsa qayta urinadi, bekor qilish mumkin) | Bepul dars — ro‘yxatdan o‘tganlar; PRO dars — PRO va adminlar. Har ko‘rishga **3 soatlik imzoli havola** |
| Kitob PDF | To‘g‘ridan-to‘g‘ri omborga | Kitob sozlamasiga ko‘ra; fayl faqat sayt orqali beriladi |
| Muqova, asoschi rasmi | To‘g‘ridan-to‘g‘ri omborga | Hamma (sayt orqali) |
| Avatar, topshiriq rasmi | Sayt orqali (4 MB gacha) | Egasi va adminlar |

Ombor **yopiq** turadi: unga hech kim to‘g‘ridan-to‘g‘ri kira olmaydi. Fayl yuklanganda sayt uning hajmini va turini
(birinchi baytlarini) tekshiradi — mos kelmasa, fayl darhol o‘chiriladi.

## 1. Bucket yaratish

1. **dash.cloudflare.com** → ro‘yxatdan o‘ting → chap menyu **R2 Object Storage** → (birinchi marta) to‘lov kartasini
   tasdiqlang — 10 GB gacha pul yechilmaydi.
2. **Create bucket** → nom: `auforex-media` → Location: **Automatic** → **Create bucket**.
3. Bucket → **Settings** → **Public access**: **o‘chiq** qolsin (r2.dev va Custom domain ulamang). Sayt fayllarni o‘zi
   beradi; bucket ochiq bo‘lsa, PRO videolar himoyasiz qoladi.

## 2. API kalit (token)

1. R2 bosh sahifasi → **Manage API tokens** (yoki **API** → **Manage API tokens**) → **Create API token**.
2. Permissions: **Object Read & Write**. **Specify bucket(s)** → faqat `auforex-media`. TTL: Forever.
3. **Create API Token** → keyingi sahifadagi qiymatlarni nusxalang (bu sahifa bir marta ko‘rsatiladi):
   - **Access Key ID**
   - **Secret Access Key**
   - **S3 endpoint**: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` (oxiridagi `/auforex-media` qismisiz)

Bu kalitlarni hech kimga bermang, git’ga yozmang — faqat Vercel sozlamalariga.

## 3. CORS (brauzerdan yuklash uchun)

Bucket → **Settings** → **CORS Policy** → **Add CORS policy** (yoki Edit) → JSON:

```json
[
  {
    "AllowedOrigins": ["https://auforex.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Range"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

- `AllowedOrigins` ichida brauzerda ochiladigan **aniq production origin** bo‘lishi shart (protokol va host, yo‘l yoki yakuniy `/` emas). O‘z domeningiz bo‘lsa, uni ham qo‘shing: `["https://auforex.vercel.app", "https://auforex.uz"]`.
- Preview uchun Production bucket va kalitlarini ishlatmang. Alohida yopiq Preview bucket hamda faqat shu bucket’ga **Object Read & Write** huquqli alohida token yarating. Preview origin faqat test bucket CORS’ida bo‘lsin. Joriy `fix/platform-stabilization` branch alias’i uchun misol:

```json
[
  {
    "AllowedOrigins": ["https://auforex-git-fix-platform-st-5a4a2f-hamidullos-projects-d86a2122.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Range"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

  Agar Vercel’da branch alias o‘zgargan bo‘lsa, `Deployments` sahifasidagi **Preview** domenining faqat origin qismini kiriting. `localhost` uchun alohida lokal bucket/token ishlating.
- Brauzer `PUT`dan oldin `OPTIONS` preflight yuboradi: undagi `Access-Control-Request-Method` qiymati `PUT`, so‘raladigan sarlavha esa `Content-Type`. `OPTIONS`ni `AllowedMethods`ga qo‘shmang; qoida `PUT` va `Content-Type`ni ruxsat etishi kerak. Faqat Origin’siz oddiy `OPTIONS` so‘rovi bu preflight’ni tekshirmaydi.
- `ExposeHeaders: ETag` **shart**: katta video bo‘laklab yuklanadi va sayt har bo‘lakning ETag’ini o‘qiydi.
  Busiz katta video yuklanayotganda “Ombor ETag qaytarmadi — bucket CORS’da ExposeHeaders: ["ETag"] kerak” xatosi chiqadi.
- CORS brauzerga qaysi origin so‘rov yuborishi mumkinligini belgilaydi; bucket’ni ommaga ochmaydi va token huquqlarini kengaytirmaydi. Production va Preview bucket’larida **Public access o‘chiq** qolsin.
- Brauzerda xato bo‘lsa, Network panelidagi `OPTIONS` so‘rovining `Origin`, `Access-Control-Request-Method` va `Access-Control-Request-Headers` qiymatlarini tekshiring. Imzoli URL’dagi query parametrlarni (jumladan signature’ni) hech kimga yubormang.

## 4. Tugallanmagan yuklashlarni tozalash

Bucket → **Settings** → **Object lifecycle rules**: “Abort incomplete multipart uploads” qoidasi borligini tekshiring
(Cloudflare odatda 7 kunlik qoidani o‘zi qo‘shadi). Bo‘lmasa: **Add rule** → butun bucket → **Abort incomplete
multipart uploads** → 1 kun. Sayt bekor qilingan yuklashlarni o‘zi to‘xtatadi; bu qoida brauzer yopilib qolgan holatlar uchun.

## 5. Vercel’ga kiritish

Vercel → loyiha → **Settings → Environment Variables** → Production qiymatlarini Production’ga qo‘shing. Preview uchun shu nomli o‘zgaruvchilarni **Preview** muhitiga alohida qo‘shib, qiymatlarini Preview test bucket/tokeniga bog‘lang; Production kalitlarini Preview’da qayta ishlatmang:

| Nom | Qiymat |
|---|---|
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_BUCKET` | `auforex-media` |
| `S3_ACCESS_KEY_ID` | 2-qadamdagi Access Key ID |
| `S3_SECRET_ACCESS_KEY` | 2-qadamdagi Secret Access Key |
| `S3_REGION` | `auto` (R2 uchun; bo‘sh qoldirilsa ham `auto`) |

To‘rttasi birga bo‘lishi kerak — bittasi yetishmasa, sayt ishga tushganda qaysi biri yo‘qligini aytadi.
Preview env’da `S3_BUCKET` va API kalitlari alohida test bucket/tokeniga tegishli bo‘lsin. Keyin tegishli muhitning **Deployments** sahifasidan deploy’ni qayta yarating.

## 6. Tekshirish

1. **Super admin → Sozlamalar → Tizim → “Omborni tekshirish”**. Sayt joylashgan serverning o‘zidan, haqiqiy kalitlar
   bilan tekshiradi:
   - kalitlar va bucket (kichik test fayli yoziladi, o‘qiladi va o‘chiriladi — `_healthcheck/…`);
   - CORS: sayt manzilidan brauzer yuklashiga ruxsat (`PUT` + `Content-Type`);
   - CORS: `ETag` sahifaga ko‘rinadimi (katta videolar uchun shart);
   - bo‘laklab yuklash (multipart) boshlash va bekor qilish.

   Har bir qadam ✓ yoki ✗ va **nimani tuzatish kerakligi** bilan chiqadi.
2. Xuddi shu tekshiruv kompyuterdan (`.env` dagi S3_* bilan):

   ```bash
   npm run storage:check -- --origin https://auforex.vercel.app
   ```

3. `https://auforex.vercel.app/api/health` → `"storage":{"driver":"s3","uploads":"ok"}` bo‘lishi kerak.
   `"driver":"local","uploads":"not_configured"` bo‘lsa — S3_* qiymatlari saqlanmagan yoki Redeploy qilinmagan.
   `"uploads":"config_invalid"` bo‘lsa — `error` maydonida qaysi qiymat noto‘g‘ri yozilgani aytiladi (kalitlar ko‘rsatilmaydi).
4. **Super admin → Sozlamalar → Asoschi** → rasm yuklang → **Saqlash** → bosh sahifada rasm ko‘rinsin.
5. **Super admin → Darslar → Yangi dars** → kichik MP4 yuklang (foiz ko‘rsatkichi 100% ga yetadi, “Video yuklangan”) →
   saqlang → dars sahifasida video o‘ynasin.
6. Cloudflare’da bucket → **Objects**: `videos/…`, `founder/…` fayllari paydo bo‘lgan bo‘lsin.

## Muammo bo‘lsa

| Belgi | Sabab va yechim |
|---|---|
| Yuklash boshida “Tarmoq yoki CORS xatosi” | CORS’da aniq sayt manzili, `PUT` yoki `Content-Type` ruxsat etilmagan (3-qadam); brauzer preflight javobini tekshiring |
| “Ombor ETag qaytarmadi …” | CORS’da `"ExposeHeaders": ["ETag"]` yo‘q |
| “Fayl omboriga ulanishda xato (S3 kalitlari noto‘g‘ri …)” | Kalit noto‘g‘ri yoki boshqa bucket’ga berilgan; tokenni qayta yarating va Vercel’da yangilang |
| “Fayl omboriga ulanishda xato (S3_BUCKET nomi noto‘g‘ri)” | `S3_BUCKET` Cloudflare’dagi nom bilan aynan bir xil bo‘lsin |
| “Fayl saqlash sozlanmagan …” | S3_* o‘zgaruvchilari kiritilmagan yoki Redeploy qilinmagan |
| “Fayl ombori sozlamasi noto‘g‘ri: … r2.dev …” | `S3_ENDPOINT` ga bucket’ning ommaviy r2.dev manzili yozilgan. S3 API manzili kerak: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| “Fayl ombori sozlamasi noto‘g‘ri: … yo‘l bo‘lmasin” | `S3_ENDPOINT` oxirida bucket’dan boshqa yo‘l bor. Faqat `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` (oxiridagi `/auforex-media` ham qabul qilinadi) |
| “… ombor vaqtincha javob bermadi” | R2 20 soniya ichida javob bermadi yoki tarmoq uzildi (sayt 3 marta qayta urinadi). Birozdan so‘ng qayta urining; takrorlansa Cloudflare status sahifasini tekshiring |
| Kitob ochilmaydi (“Kitob fayli serverda topilmadi”) | Super admin → Kitoblar → **Kitob fayllarini tekshirish → Tekshirish**: dastlabki 3 kitob sayt ichidagi nusxaga qayta ulanadi; qolganlarini qayta yuklang |

Boshqa S3 xizmatlari ham ishlaydi (AWS S3, Backblaze B2, DigitalOcean Spaces): `S3_ENDPOINT` ga ularning endpoint’ini,
`S3_REGION` ga mintaqasini (masalan `eu-central-1`) yozing.
