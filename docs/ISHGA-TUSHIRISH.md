# AU Forex Academy — kompyuterda ishga tushirish (Windows)

Barcha buyruqlar **PowerShell** yoki VS Code terminalida, loyiha papkasi ichida bajariladi.

## 0. Kerakli dasturlar

- **Node.js 22 LTS** — https://nodejs.org (tekshirish: `node -v` → `v22…`)
- **Docker Desktop** (PostgreSQL uchun eng oson yo‘l) — yoki kompyuterga o‘rnatilgan PostgreSQL 16

## 1. ZIP’ni to‘g‘ri ochish

Birinchi marta o‘rnatsangiz — yangi ZIP’ni **bo‘sh papkaga** oching, masalan `C:\Projects`.
Eski versiya ustiga ochmang: eski fayllar (masalan `app\admin`) qolib ketadi va loyiha yig‘ilmaydi.
`npm run dev` bunday qoldiqni o‘zi aniqlaydi va nima qilish kerakligini yozadi.

## 1a. Eski versiyani yangilash (bazangiz, `.env` va yuklangan fayllar saqlanadi)

Yangi kod **aynan ishlab turgan papkangizga** tushishi kerak. ZIP ichida `au-forex-academy` papkasi bor,
shuning uchun uni papkangiz turgan joyga (masalan Desktop’ga) ochasiz — ichiga emas:

- **PowerShell:**
  `Expand-Archive -Force "$HOME\Downloads\au-forex-academy-v5.zip" "$HOME\Desktop"`
- **yoki Explorer:** ZIP’ni ikki marta bosing → ichidagi `au-forex-academy` papkasini Desktop’ga sudrang →
  “Replace the files in the destination” (Fayllarni almashtirish).

`.env`, `storage` (kitoblar, videolar, rasmlar) va `node_modules` ZIP’da yo‘q, ular joyida qoladi.

Keyin papka ichida (Git Bash):

```bash
rm -rf app/admin .next        # eski admin panel va eski kesh
npm install
npm run setup                 # yetishmayotganini .env’ga qo‘shadi, borini o‘zgartirmaydi
npm run db:fix                # bazani topadi va ulanishni to‘g‘rilaydi (Docker Desktop ochiq bo‘lsin)
npx prisma migrate deploy     # "3 migrations found" chiqishi kerak
npm run db:seed
npm run founder:password      # founder login va parolini ko‘rsatadi
npm run doctor
npm run dev
```

Yangi versiya tushganini tekshirish: `npm run` ro‘yxatida `setup`, `doctor`, `founder:password` bo‘lishi kerak.
Bo‘lmasa — kod boshqa papkaga ochilgan (ko‘pincha `au-forex-academy\au-forex-academy` bo‘lib qoladi).

**Baza porti.** Agar `.env` dagi `DATABASE_URL` 5433 kabi boshqa portda bo‘lsa (Windows’da 5432 band bo‘lganda),
`npm run setup` uni `DB_PORT` ga ko‘chiradi va `docker compose` bazani o‘sha portda ochadi.

## 2. O‘rnatish va sozlash

```powershell
npm install
npm run setup
```

`npm run setup`:
- `.env` faylini yaratadi (bo‘lmasa);
- maxfiy kalit `BETTER_AUTH_SECRET` ni yaratadi;
- founder uchun kuchli parol yaratib, `.env` ga yozadi va ekranga chiqaradi.

Bor qiymatlarni hech qachon o‘zgartirmaydi — qayta ishga tushirish xavfsiz.

## 3. Ma’lumotlar bazasi

Docker Desktop’ni oching, keyin (`npm run db:fix` bazani o‘zi ishga tushiradi; 5432-port band bo‘lsa bo‘sh portni tanlaydi):

```powershell
npm run db:fix
npx prisma migrate deploy
npm run db:seed
```

O‘zingizning PostgreSQL’ingiz bo‘lsa, `.env` ichidagi `DATABASE_URL` ni unga moslang
(masalan `postgresql://postgres:PAROL@localhost:5432/auforex`) va bazani oldindan yarating.

## 4. Tekshirish

```powershell
npm run doctor
```

Har bir band ✓ yoki ✗ bilan chiqadi, ✗ yonida uni tuzatadigan buyruq yoziladi.

## 5. Ishga tushirish

```powershell
npm run dev
```

- Sayt: http://localhost:3000
- Super admin panel: http://localhost:3000/super-admin
  (`/superadmin` va eski `/admin` ham shu yerga olib boradi)

## Founder kirishi

- Login: `asadbek`
- Parol: `.env` dagi `FOUNDER_PASSWORD`

Parol ishlamasa yoki unutilgan bo‘lsa:

```powershell
npm run founder:password
```

Bu buyruq `.env` dagi `FOUNDER_PASSWORD` ni bazaga yozadi va yangi parolni ekranga chiqaradi.
O‘zingiz tanlagan parol uchun: `npm run founder:password Yangi-Parol-2026` (kamida 12 belgi, harf va raqam).

## Telefonda sinash

1. `npm run dev` ishlab turgan bo‘lsin. Terminalda `Network: http://192.168.x.x:3000` qatori chiqadi.
2. Telefonni kompyuter bilan **bir xil Wi-Fi** ga ulang va shu manzilni oching.
3. Windows birinchi marta so‘rasa, Node.js’ga **Private network** ruxsatini bering (Windows Defender Firewall).

Ishlab chiqish rejimida telefon orqali kirish (login) va jonli yangilanish ishlaydi.
Serverga joylaganda faqat `.env` dagi `BETTER_AUTH_URL` (va `TRUSTED_ORIGINS`) manzillari qabul qilinadi.

## Ko‘p uchraydigan muammolar

| Belgisi | Sababi va yechimi |
|---|---|
| `/superadmin` → 404 | Panel manzili `/super-admin`. Yangi versiyada `/superadmin` ham ishlaydi. |
| `Missing script: "setup"` (yoki `doctor`) | Terminal eski kod turgan papkada. Yuqoridagi “Eski versiyani yangilash” bo‘limiga qarang. |
| `prisma migrate deploy` “2 migrations found” deydi | Yangi kod hali tushmagan (yangi versiyada 3 ta). |
| “Next.js ignored package-lock.json in C:\Users\…” | Yangi versiyada tuzatilgan. Uy papkangizdagi ortiqcha `package-lock.json` ni o‘chirsangiz ham bo‘ladi. |
| `docker compose up` “port is already allocated” | 5432 band: `.env` da `DB_PORT="5433"` va `DATABASE_URL` da ham `:5433` qiling. |
| `npm run dev` “Eski versiyadan qolgan papka” deydi | `Remove-Item -Recurse -Force app\admin` yoki ZIP’ni bo‘sh papkaga qayta oching. |
| `Authentication failed … credentials for postgres are not valid` (P1000) | Bu port’da boshqa PostgreSQL (Windows’ga o‘rnatilgan) javob beryapti yoki Docker bazasining paroli boshqacha. **`npm run db:fix`** — Docker bazasini topadi, kerak bo‘lsa bo‘sh portga ko‘chiradi, `.env` ni to‘g‘rilaydi. Ma’lumotlar o‘chmaydi. |
| `Can't reach database` / `ECONNREFUSED` | PostgreSQL ishlamayapti: Docker Desktop’ni oching → `npm run db:fix`. |
| VS Code’da `Cannot find module 'next/headers'` kabi qizil xatolar | `npm install` paytida ochiq qolgan fayllar. `Ctrl+Shift+P` → **TypeScript: Restart TS Server** (yoki **Developer: Reload Window**). Sayt ishlashiga ta’sir qilmaydi. |
| Login: “Login yoki parol noto‘g‘ri” | `npm run founder:password` |
| Kitob ochilmaydi | `npm run doctor` — kitob fayllari va PDF o‘quvchini tekshiradi. |
| Telefonda sahifa ochilmaydi | Bir xil Wi-Fi’dami? Firewall Node.js’ga ruxsat berganmi? `localhost` emas, `192.168…` manzil kerak. |
| `Invalid environment configuration` | `npm run setup`, so‘ng `npm run doctor`. |

## Serverga joylash (qisqacha)

`.env` dagi `BETTER_AUTH_URL` va `NEXT_PUBLIC_APP_URL` ni haqiqiy domenga (`https://…`) o‘zgartiring,
keyin `npm run build` va `npm run start`, yoki `docker compose up --build`. Batafsil: README.md → “Production deployment”.
