# AU Forex Academy’ni internetga chiqarish (Railway)

Natija: sayt `https://….up.railway.app` manzilida hammaga ochiladi, keyin o‘z `.uz` domeningizni ulaysiz.
Railway’da 3 ta narsa bo‘ladi:

| Qism | Vazifasi |
|---|---|
| **web** xizmati | Saytning o‘zi (loyihadagi `Dockerfile` bilan quriladi) |
| **Postgres** | Ma’lumotlar bazasi (foydalanuvchilar, darslar, arizalar…) |
| **Volume** `/app/storage` | Yuklangan fayllar: kitoblar (PDF), videolar, rasmlar. Volume’siz ular har deployda o‘chadi |

Har ishga tushishda server o‘zi: sozlamalarni tekshiradi → bazani yangilaydi (migratsiya) → boshlang‘ich
ma’lumotlarni qo‘shadi (3 ta kitob, founder hisobi; bor narsaga tegmaydi) → saytni yoqadi.

Barcha buyruqlar loyiha papkasida, **Git Bash** da bajariladi.

## 1. Railway CLI

```bash
npm i -g @railway/cli
railway login
```

`railway login` brauzerni ochadi — MarkazOne’dagi Railway hisobingiz bilan kiring.

## 2. Loyiha, baza va web xizmati

```bash
railway init                      # loyiha nomi: au-forex-academy
railway add --database postgres   # baza (nomi "Postgres" bo‘ladi)
railway add --service web         # sayt uchun bo‘sh xizmat
railway domain --service web      # https://….up.railway.app manzilini yaratadi — eslab qoling
railway volume add --service web --mount-path /app/storage
```

Domen **birinchi deploydan oldin** yaratilishi kerak: sayt manzili qurish paytida kodga yoziladi.

## 3. O‘zgaruvchilar (Variables)

```bash
npm run deploy:env
```

Bu buyruq yangi maxfiy kalit va founder parolini yaratib, tayyor blokni chiqaradi.
**Founder parolini saqlab qo‘ying.**

`railway open` → **web** xizmati → **Variables** → **Raw Editor** → blokni to‘liq joylang → **Update Variables**.

Blok quyidagilarni o‘rnatadi:

| O‘zgaruvchi | Qiymati |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` — Railway bazasiga avtomatik ulanadi |
| `BETTER_AUTH_SECRET` | tasodifiy 64 belgili kalit |
| `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` — 2-qadamdagi domen |
| `STORAGE_LOCAL_ROOT` | `/app/storage` — Volume |
| `FOUNDER_USERNAME`, `FOUNDER_PASSWORD` | founder kirishi |

## 4. Deploy

```bash
railway up --service web
```

Birinchi qurish 3–6 daqiqa oladi. Loglarda quyidagilar chiqishi kerak:

```
[start] Sayt: https://….up.railway.app · fayllar: /app/storage
✓ founder super admin "asadbek" created
  • Bozorni zabt etish — 1-kitob: added …
[start] Next.js 8080-portda ishga tushmoqda…
✓ Ready
```

Keyin `https://….up.railway.app` ni oching → **Kirish** → login `asadbek`, parol — 3-qadamdagi.
Panel: `https://….up.railway.app/super-admin`.

Tavsiya: **web → Settings → Deploy → Healthcheck Path** = `/api/health`
(server baza bilan ishlay olmasa, Railway yangi versiyani ishga tushirmaydi).

## 5. Keyin yangilash

Kodni o‘zgartirgach, o‘sha papkada:

```bash
railway up --service web
```

Baza va Volume’dagi fayllar saqlanadi.

## 6. O‘z domeningiz (.uz)

```bash
railway domain sizning-domen.uz --service web
```

Railway ko‘rsatgan DNS yozuvini (CNAME) domen panelingizga qo‘shing. Domen ishlagach, Variables’da:

```
BETTER_AUTH_URL=https://sizning-domen.uz
NEXT_PUBLIC_APP_URL=https://sizning-domen.uz
```

so‘ng `railway up --service web` (manzil kodga qayta yozilishi uchun).

## Videolar haqida

Railway bitta so‘rovni 15 daqiqada uzadi, ayrim foydalanuvchilar ~125 MB dan katta yuklashlarda xatoga uchragan.
Katta videolarni **YouTube (unlisted / “ro‘yxatda yo‘q”)** yoki **Bunny Stream** ga yuklab, darsga havolasini qo‘yish
ishonchliroq — panel bu havolalarni qabul qiladi. Kitoblar (PDF) va rasmlar to‘g‘ridan-to‘g‘ri yuklanaveradi.

## Muammo bo‘lsa

| Belgisi | Yechim |
|---|---|
| Deploy loglarida `✗ BETTER_AUTH_SECRET yo‘q…` / `✗ DATABASE_URL yo‘q…` | 3-qadamdagi blok to‘liq joylanmagan |
| `✗ Sayt manzili noma’lum` | 2-qadamdagi `railway domain --service web` bajarilmagan |
| `⚠ Railway Volume ulanmagan` | `railway volume add --service web --mount-path /app/storage`, so‘ng qayta deploy |
| Kirishda xato / sahifa ochilmaydi | `railway logs --service web` — oxirgi qatorlarni menga yuboring |
| Founder parolini unutdingiz | Variables’da `FOUNDER_PASSWORD` ni o‘zgartiring, so‘ng web → **Shell** (yoki `railway ssh`): `npm run founder:password` |

Zaxira: Railway’da Postgres → **Backups** ni yoqing; Volume’dagi fayllar uchun ham vaqti-vaqti bilan zaxira oling.
