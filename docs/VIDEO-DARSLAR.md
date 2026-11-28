# Video darslar

Videolar YouTube’da emas — saytning yopiq omborida (Cloudflare R2) yoki Bunny Stream’da turadi va faqat saytda ko‘rinadi.
Har bir dars **Bepul** (ro‘yxatdan o‘tgan hamma) yoki **PRO** (faqat PRO obunachilar va adminlar) bo‘ladi.

## Qanday himoyalangan

- Ruxsati yo‘q foydalanuvchi (mehmon yoki PRO’siz) PRO dars sahifasida faqat dars nomi va “PRO kerak” oynasini ko‘radi —
  sahifa kodida ham video manzili bo‘lmaydi. Video API ham xuddi shu tekshiruvni qiladi (403).
- Omborga yuklangan video har ko‘rishda **3 soat amal qiladigan imzoli havola** orqali beriladi; ombor yopiq.
- Bunny Stream: `BUNNY_STREAM_TOKEN_KEY` o‘rnatilsa, har ko‘rishga **6 soatlik imzoli havola**.
- Darslar **ketma-ket** ochiladi: kurs ichida keyingi dars oldingisi yakunlangach ochiladi (sahifa, video va progress API’da
  tekshiriladi). Adminlarga hammasi ochiq. Sozlama: **Super admin → Sozlamalar → Kirish → “Darslar ketma-ket ochilsin”**.

## Avval bir marta

1. Fayl ombori: [FAYL-SAQLASH.md](FAYL-SAQLASH.md) (R2 + 4 ta `S3_*` o‘zgaruvchi). Busiz “Fayl yuklash” yorlig‘ida
   ogohlantirish chiqadi va faqat Bunny havolasi ishlaydi.
2. **Super admin → Kategoriyalar** → “Video dars kategoriyalari”: masalan *Trading asoslari*, *Texnik tahlil*,
   *Risk menejmenti*. Tartibini ↑/↓ bilan o‘zgartiring — talabalar sahifasida shu tartibda chiqadi.
   Darslari bor kategoriyani o‘chirib bo‘lmaydi (avval darslarni boshqa kategoriyaga o‘tkazing).
3. **Super admin → Kurslar** → kurs yarating, kategoriyasini tanlang, “Nashr qilingan”ni yoqing.

## Dars qo‘shish (Super admin → Darslar → Yangi dars)

| Maydon | Izoh |
|---|---|
| Video dars nomi | Masalan “Trend chiziqlari” |
| Kategoriya | **Majburiy**. Hali tanlanmagan bo‘lsa, kurs tanlanganda kursning kategoriyasi qo‘yiladi |
| Kurs | Dars qaysi kursda |
| Dars raqami | 1, 2, 3 … Kurs tanlanganda keyingi bo‘sh raqam o‘zi qo‘yiladi. Bir kursda bir raqam faqat bir marta — band bo‘lsa, qaysi dars egallaganini aytadi |
| Kirish darajasi | Boshlang‘ich / O‘rta / Yuqori (ixtiyoriy) |
| Dars tavsifi | Talaba video ostida ko‘radi |
| Video manbasi | **Fayl yuklash** — MP4/WEBM, foiz ko‘rsatiladi, “Bekor qilish” bor, uzilsa o‘zi qayta urinadi. **Tashqi havola** — Bunny Stream embed havolasi |
| Muqova rasmi | Ixtiyoriy, 16:9 |
| Davomiyligi | Fayl tanlanganda o‘zi aniqlanadi |
| Foydalanish huquqi | **PRO** (standart) yoki **Bepul** |
| Holati | Qoralama (faqat adminlar ko‘radi) yoki Nashr qilingan |

Sarlavha talabaga **“Texnik tahlil — 5-dars”** ko‘rinishida chiqadi (forma tepasida oldindan ko‘rinadi).

**Darslar ro‘yxati** (Super admin → Darslar): qidiruv, kategoriya/kurs/holat bo‘yicha filtr; har qatorda ko‘rish, ↑/↓
(raqamlarni almashtiradi), tahrirlash va o‘chirish. O‘chirishdan oldin nechta talaba progressi borligi ko‘rsatiladi.

## Bunny Stream (ixtiyoriy)

1. **bunny.net** → **Stream** → **Add Video Library**.
2. Kutubxona → **Security** → **Token authentication key**ni nusxalang; “Allowed domains”ga `auforex.vercel.app` qo‘shing.
3. Vercel: `BUNNY_STREAM_TOKEN_KEY` = shu kalit → **Redeploy**. Shundan **keyin** Bunny’da **Embed view token
   authentication**ni yoqing (aks holda videolar vaqtincha ochilmay qoladi).
4. Har video: Bunny → Upload → **Embed** havolasi (`https://iframe.mediadelivery.net/embed/<kutubxona>/<video-id>`) →
   dars formasidagi **Tashqi havola** yorlig‘iga.

## Muammo bo‘lsa

- Yuklash xatolari (CORS, ETag, kalit): [FAYL-SAQLASH.md → Muammo bo‘lsa](FAYL-SAQLASH.md#muammo-bolsa).
- Bunny videosi o‘rnida 403: `BUNNY_STREAM_TOKEN_KEY` Bunny’dagi **Token authentication key**ga mos emas yoki Redeploy qilinmagan.
- “Bu kursda N-dars allaqachon bor”: boshqa raqam tanlang yoki ro‘yxatda ↑/↓ bilan tartibni o‘zgartiring.

## ZIP arxivdan saytga (Super admin panel orqali)

`npm run content:import` arxivdagi videolarni **Super admin panelining o‘zi orqali** joylaydi: kategoriya, kurs
va darslar odatdagi formalar bilan yaratiladi, video saytning R2 omboriga to‘g‘ridan-to‘g‘ri (bo‘laklab) yuklanadi.
Kompyuterda baza yoki ombor kalitlari kerak emas — faqat super admin hisobi. ffmpeg, python3 va
Playwright Chromium (`npx playwright install chromium`) kerak.

Arxiv tuzilishi (bitta umumiy papka bo‘lsa, ochib olinadi):

```
<Kategoriya>/<01 - Dars nomi>.mp4            → kurs = kategoriya nomi
<Kategoriya>/<Kurs>/<01 - Dars nomi>.mp4     → kategoriya ichida alohida kurs
```

Tartib nomlardagi raqamdan olinadi: `01 - …`, `1-dars …`, `Dars 3 …` (10-dars 9-darsdan keyin keladi).
Raqam bo‘lmasa yoki takrorlansa, alifbo tartibida 1, 2, 3… beriladi.

1. **Reja** (hech narsa yuklanmaydi):
   ```bash
   npm run content:import -- plan darslar.zip --free 1
   ```
   `content-import/PLAN.md`: kategoriyalar, kurslar, dars raqamlari va nomlari, davomiyligi, hajmi, Bepul/PRO va har
   fayl uchun holat. `--free 1` har kursning 1-darsini bepul qiladi (standart: hammasi PRO).
   Holatlar: **upload** (tayyor MP4/WebM) · **remux** (MOV yoki indeksi oxirida — sifat o‘zgarmaydi) ·
   **transcode** (HEVC, 10-bit va h.k. — brauzer o‘ynatmaydi, qayta kodlash kerak) · **skip** (o‘qilmaydi yoki
   mazmuni boshqa fayl bilan **bir xil** — takror dars yaratilmaydi). 2 GB dan katta fayllar ham siqiladi.
   Nomlar va Bepul/PRO ni `content-import/plan.json` da tahrirlash mumkin.
2. **Tayyorlash:** `npm run content:import -- prepare` (qayta kodlash faqat `--allow-transcode` bilan).
3. **Yuklash:**
   ```bash
   IMPORT_ADMIN_EMAIL=… IMPORT_ADMIN_PASSWORD=… npm run content:import -- import --site https://auforex.vercel.app
   ```
   Kurslar **nashr qilinmagan** holda yaratiladi. Qayta ishga tushirish xavfsiz: saytda bor darslar (shu kursda
   shu nom yoki raqam) o‘tkazib yuboriladi, natija `content-import/ledger.json` da saqlanadi.
4. **Tekshirish:** `… -- verify --site …` — har dars saytda bitta, videosi ombordan ochiladi (206).
5. **Nashr:** tekshirib, tasdiqlagandan keyin `… -- publish --site …`.

**Bitta kurs (seriya) uchun — tasdiqlangan nomlar, kategoriya, tavsif va muqova bilan:**
[`content/forex-kurs.json`](../content/forex-kurs.json) da kurs nomi/tavsifi/kategoriyasi va har dars (raqami bo‘yicha)
uchun nom, kategoriya, daraja (`BEGINNER`/`INTERMEDIATE`/`ADVANCED`), kirish (`FREE`/`PRO`), mavzular va tavsif yoziladi.

```bash
npm run content:import -- plan <papka yoki zip> --meta content/forex-kurs.json   # PLAN.md: bitta jadval, dars tartibida
npm run content:import -- covers            # covers/NN.jpg — sayt uslubidagi 16:9 muqova (logotip, raqam, nom, mavzular)
npm run content:import -- prepare           # MP4 indeksini boshiga ko‘chirish (sifat o‘zgarmaydi)
npm run content:import -- import --site …   # tavsif, daraja va muqova bilan
npm run content:import -- verify --site …
npm run content:import -- update-covers --site …   # muqova o‘zgartirilsa, saytdagi darslarda almashtiradi
```

Muqova saytdagi bo‘sh joylarga moslangan: katalogdagi “Bepul” belgisi (yuqori chap), pleyerdagi tomoshabin belgisi
(yuqori o‘ng), pleyer boshqaruvi (pastki qism) va o‘ynatish tugmasi (pastki o‘ng) ustiga matn tushmaydi.
1-bosqich rejasi: [`content/PLAN-1-bosqich.md`](../content/PLAN-1-bosqich.md).

Sinov (Preview, 27.11.2026): arxiv → 2 kategoriya, 5 dars (takror fayl o‘tkazib yuborildi, MOV va indeks oxirida →
remux, HEVC → H.264). Ikkinchi ishga tushirishda 0 ta yangi dars. Tezlik: 116 MB video 26,7 MB/s.

## Ko‘p videoni bir buyruq bilan qo‘shish (o‘z kompyuteringizda)

`npm run videos:import` papkadagi videolarni yuklaydi va saytga kurs/dars qilib, tartib bilan qo‘shadi. Ikki manzil bor:

- **`--to r2`** (tavsiya) — saytning o‘z ombori (Cloudflare R2), admin panelidan yuklangan videolar bilan bir xil:
  himoyalangan, faqat PRO/bepul qoidalari bo‘yicha o‘ynaydi. Faqat **MP4 (H.264/AAC)** va **WebM** — brauzer o‘ynaydigan
  formatlar; boshqalari (MOV, MKV, AVI) rejada “o‘tkazib yuboriladi” deb ko‘rsatiladi, ularni avval MP4 ga o‘tkazing.
  10 MB dan katta videolar 10 MB bo‘laklab, bir vaqtda 4 ta bo‘lak yuklanadi; uzilgan bo‘lak qayta yuboriladi,
  xatoda ombordagi chala fayl o‘chiriladi. Har video mazmuni (birinchi baytlar) va yuklangandan keyin hajmi tekshiriladi.
- **`--to bunny`** — Bunny Stream (darslar Bunny pleyeri orqali o‘ynaydi).

`--to` berilmasa: `.env.import` da Bunny kalitlari bo‘lsa Bunny, aks holda S3_* bo‘lsa R2.

**1. Papkani tayyorlang** — har bir kurs alohida papka, videolar raqam bilan boshlansin:

```
D:\AU Forex darslar\
  01 Trading asoslari\
    01 - Trading nima.mp4
    02 - Bozor turlari.mp4
  02 Texnik tahlil\
    01 - Trend chiziqlari.mp4
```

Kurs nomi = papka nomi, dars nomi = fayl nomi (boshidagi raqamsiz), tartib = raqam (2 → 10 dan oldin).
MP4/MOV fayllarning davomiyligi avtomatik o‘qiladi.

**2. Loyiha papkasida `.env.import` fayl yarating** (git’ga tushmaydi, hech kimga bermang):

```
DATABASE_URL="…"          # Vercel → Storage → bazangiz → .env.local yorlig‘idagi DATABASE_URL
# R2 uchun (Vercel’dagi qiymatlar bilan bir xil, docs/FAYL-SAQLASH.md):
S3_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
S3_BUCKET="auforex-media"
S3_ACCESS_KEY_ID="…"
S3_SECRET_ACCESS_KEY="…"
# yoki Bunny uchun:
BUNNY_LIBRARY_ID="123456" # Bunny → Stream → kutubxona → API → Video Library ID
BUNNY_API_KEY="…"         # o‘sha sahifadagi API Key (token kaliti emas!)
```

> Production bazasi va bucket’iga yuklashdan oldin bir marta test baza/bucket bilan sinab ko‘ring.

**3. Avval reja, keyin yuklash:**

```
npm run videos:import -- "D:\AU Forex darslar" --to r2          # reja: nima qo‘shilishini ko‘rsatadi, hech narsa yuklamaydi
npm run videos:import -- "D:\AU Forex darslar" --to r2 --yes    # yuklaydi
```

Qo‘shimcha: `--category "Texnik tahlil"` (yangi kurslarga kategoriya), `--course "Nom"` (videolar papka ichida to‘g‘ridan-to‘g‘ri bo‘lsa).

- Internet uzilsa yoki biror video o‘tmasa — buyruqni qayta ishga tushiring: qo‘shilganlari o‘tkazib yuboriladi, qolganlari o‘z o‘rniga tushadi.
- Yangi kurslar **nashr qilinmagan** holda yaratiladi: Super admin → Kurslar’da tekshirib, “Nashr qilingan”ni yoqing.
- Bunny videoni qayta ishlashi (encoding) har bir video uchun bir necha daqiqa oladi — shu vaqt ichida pleyer “processing” deydi (R2 da bunday kutish yo‘q).
- Darslar PRO sifatida yaratiladi; bepul qilish, kategoriya yoki muqova — Super admin → Video darslar → Tahrirlash.
