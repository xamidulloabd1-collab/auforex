# Video darslar: Bunny Stream + ketma-ket ochilish

Videolar YouTube’da emas, **Bunny Stream**’da saqlanadi va faqat saytda, faqat **PRO** foydalanuvchilarga ko‘rinadi.
Vercel’da video faylni saytning o‘ziga yuklab bo‘lmaydi (server diski faqat o‘qish uchun), shuning uchun video Bunny’da turadi.

## Qanday himoyalangan

- Dars sahifasi va video havolasi faqat PRO (va adminlar) uchun. Mehmon va FREE foydalanuvchi sahifa kodida ham video ID’ni olmaydi.
- `BUNNY_STREAM_TOKEN_KEY` o‘rnatilgan bo‘lsa, sayt har bir ko‘rishga **6 soat amal qiladigan imzoli havola** beradi
  (`token = SHA256(kalit + video id + expires)`). Nusxalab tarqatilgan havola 6 soatdan keyin ishlamaydi.
- Darslar **ketma-ket** ochiladi: kurs ichida keyingi dars oldingisi yakunlangach ochiladi. Bu sahifada, video oqimida
  va progress API’da tekshiriladi. Adminlar uchun hammasi ochiq.

## Bir martalik sozlash

1. **bunny.net** → ro‘yxatdan o‘ting → **Stream** → **Add Video Library** (masalan “AU Forex”).
2. Kutubxona → **Security**:
   - **Token authentication key** qiymatini nusxalang (bu kutubxonaning “API key”idan boshqa narsa).
   - “Allowed domains” bo‘lsa, `auforex.vercel.app` ni qo‘shing (o‘z domeningiz bo‘lsa, uni ham).
3. **Vercel** → loyiha → **Settings → Environment Variables**:
   `BUNNY_STREAM_TOKEN_KEY` = 2-qadamdagi kalit (Production) → **Save** → **Deployments → Redeploy**.
4. Redeploy tugagach, Bunny’da **Embed view token authentication** ni yoqing.
   (Tartib muhim: avval kalit saytda bo‘lsin, keyin himoya yoqilsin — aks holda videolar vaqtincha ochilmay qoladi.)

## Har bir dars uchun

1. Bunny → kutubxona → **Upload** → videoni yuklang (kodlash tugashini kuting).
2. Video → **Embed** → havolani nusxalang: `https://iframe.mediadelivery.net/embed/<kutubxona>/<video-id>`
   (`/play/…` havolasi ham bo‘ladi — sayt uni o‘zi to‘g‘rilaydi).
3. Saytda: **Super admin → Kurslar** → kurs oching va “Nashr qilingan”ni yoqing.
4. **Super admin → Darslar → Yangi dars** → sarlavha, kurs → **Bunny Stream / havola** maydoniga havola →
   **Tartib** (1, 2, 3 …) → **Davomiylik (s)** (masalan 12 daqiqa = 720) → **Nashr qilish** → **Saqlash**.
   “Muqova rasmi”ni bo‘sh qoldiring — Vercel’da rasm yuklash ishlamaydi, Bunny pleyeri o‘z rasmini ko‘rsatadi.

Darslar **Tartib** raqami bo‘yicha ketma-ket ochiladi. Talaba darsni ko‘rib, **“Yakunlandi deb belgilash”** tugmasini
bosgach, keyingi dars ochiladi.

## Sozlamalar

**Super admin → Sozlamalar → Kirish → “Darslar ketma-ket ochilsin”** — o‘chirilsa, PRO foydalanuvchilarga hamma darslar birdan ochiladi.

## Muammo bo‘lsa

- Video o‘rnida 403 / “access denied”: Vercel’dagi `BUNNY_STREAM_TOKEN_KEY` Bunny’dagi **Token authentication key**ga mos emas
  yoki o‘rnatilgandan keyin Redeploy qilinmagan.
- Dars saqlanmayapti (“havola noto‘g‘ri”): Bunny’dagi Embed havolasini to‘liq qo‘ying (kutubxona raqami + video ID).

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
