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

## Ko‘p videoni bir buyruq bilan qo‘shish (o‘z kompyuteringizda)

`npm run videos:import` papkadagi videolarni to‘g‘ridan-to‘g‘ri Bunny’ga yuklaydi va saytga kurs/dars qilib, tartib bilan qo‘shadi.

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
BUNNY_LIBRARY_ID="123456" # Bunny → Stream → kutubxona → API → Video Library ID
BUNNY_API_KEY="…"         # o‘sha sahifadagi API Key (token kaliti emas!)
```

**3. Avval reja, keyin yuklash:**

```
npm run videos:import -- "D:\AU Forex darslar"          # nima qo‘shilishini ko‘rsatadi, hech narsa yuklamaydi
npm run videos:import -- "D:\AU Forex darslar" --yes    # yuklaydi
```

Qo‘shimcha: `--category "Texnik tahlil"` (yangi kurslarga kategoriya), `--course "Nom"` (videolar papka ichida to‘g‘ridan-to‘g‘ri bo‘lsa).

- Internet uzilsa yoki biror video o‘tmasa — buyruqni qayta ishga tushiring: qo‘shilganlari o‘tkazib yuboriladi, qolganlari o‘z o‘rniga tushadi.
- Yangi kurslar **nashr qilinmagan** holda yaratiladi: Super admin → Kurslar’da tekshirib, “Nashr qilingan”ni yoqing.
- Bunny videoni qayta ishlashi (encoding) har bir video uchun bir necha daqiqa oladi — shu vaqt ichida pleyer “processing” deydi.
