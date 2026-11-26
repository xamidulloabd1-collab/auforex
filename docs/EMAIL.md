# Email (SMTP): ro‘yxatdan o‘tishni tasdiqlash va parolni tiklash

Sayt quyidagi xatlarni yuboradi:

| Xat | Qachon | Havola muddati |
|---|---|---|
| Email manzilingizni tasdiqlang | Ro‘yxatdan o‘tganda, “qayta yuborish” bosilganda, email o‘zgartirilganda | 24 soat |
| Parolni tiklash | “Parolni unutdingizmi?” → email kiritilganda | 1 soat, bir marta ishlaydi |

Parol tiklangach, foydalanuvchining **boshqa barcha qurilmalaridagi sessiyalar yopiladi**.

## 1. Provayder tanlash

Istalgan SMTP xizmati ishlaydi. Oddiy variantlar:

- **Resend** (resend.com) — bepul rejasi bor. SMTP: `smtp.resend.com`, port `465`, login `resend`, parol = API key.
- **Brevo** (brevo.com) — `smtp-relay.brevo.com`, port `587`.
- **Gmail** (kichik hajm uchun) — `smtp.gmail.com`, port `465`, login = Gmail manzil, parol = Google hisobidagi
  **App password** (oddiy parol ishlamaydi; 2-bosqichli kirish yoqilgan bo‘lishi kerak).

Professional provayderlarda (Resend, Brevo) **domeningizni tasdiqlang** (DNS’ga SPF/DKIM yozuvlari) — busiz xatlar
Spam’ga tushadi yoki rad etiladi. `MAIL_FROM` shu tasdiqlangan domendagi manzil bo‘lsin.

## 2. O‘zgaruvchilar

Vercel → loyiha → **Settings → Environment Variables** (Production; kerak bo‘lsa Preview’ga alohida):

| Nom | Misol | Izoh |
|---|---|---|
| `SMTP_HOST` | `smtp.resend.com` | |
| `SMTP_PORT` | `465` yoki `587` | |
| `SMTP_SECURE` | bo‘sh | Bo‘sh bo‘lsa: 465 → TLS, 587 → STARTTLS (avtomatik). Faqat provayder boshqacha desa `true`/`false` |
| `SMTP_USER` | `resend` | Login talab qilinmasa bo‘sh (unda `SMTP_PASSWORD` ham bo‘sh) |
| `SMTP_PASSWORD` | API key / app password | Hech qachon git’ga yozmang |
| `MAIL_FROM` | `AU Forex Academy <no-reply@auforex.uz>` | Provayderda tasdiqlangan manzil |
| `NEXT_PUBLIC_APP_URL` | `https://auforex.uz` | Xatlardagi havolalar shu manzilga olib boradi — **https** va asosiy domen bo‘lsin |
| `REQUIRE_EMAIL_VERIFICATION` | bo‘sh | Bo‘sh = production’da tasdiqlash majburiy. Faqat ongli ravishda o‘chirish uchun `false` |

Saqlangach: **Deployments → oxirgi deploy → ⋯ → Redeploy** (o‘zgaruvchilar faqat yangi deploy’da kuchga kiradi).

> Production’da SMTP sozlanmagan bo‘lsa, ro‘yxatdan o‘tish “Pochta xizmati sozlanmagan” xabari bilan to‘xtaydi —
> tasdiqlanmagan hisoblar yaratilmaydi.

## 3. Tekshirish

1. **Super admin → Sozlamalar → Tizim** → “Menga test xat yuborish”. Xat sizning emailingizga keladi (Spam’ni ham
   tekshiring). Xato bo‘lsa, sababi shu yerda yoziladi (masalan “SMTP login yoki parol qabul qilinmadi”).
2. Kompyuterda (`.env` dagi qiymatlar bilan):

   ```bash
   npm run mail:check -- --to siz@misol.uz
   ```

3. `https://<sayt>/api/health` → `"mail":{"configured":true,"verificationRequired":true}`.
4. Yangi email bilan ro‘yxatdan o‘ting → xatdagi havolani bosing → “Email tasdiqlandi”.

## Muammo bo‘lsa

| Belgi | Sabab va yechim |
|---|---|
| “SMTP login yoki parol qabul qilinmadi” | `SMTP_USER`/`SMTP_PASSWORD` noto‘g‘ri. Gmail’da oddiy parol emas, App password kerak |
| “Pochta serveriga ulanib bo‘lmadi (ETIMEDOUT / ESOCKET)” | `SMTP_HOST` yoki port noto‘g‘ri; 465 ↔ 587 almashib qolgan bo‘lishi mumkin. `SMTP_SECURE` ni bo‘sh qoldiring |
| “Pochta serveri xatni rad etdi” | `MAIL_FROM` provayderda tasdiqlanmagan domen/manzil |
| Xat keladi, lekin havola `localhost` ga olib boradi | `NEXT_PUBLIC_APP_URL` (va `BETTER_AUTH_URL`) sayt manziliga o‘rnatilmagan; Redeploy |
| Parol tiklash “yuborildi” deydi, xat kelmaydi | Xavfsizlik uchun sayt hisob bor-yo‘qligini aytmaydi. Vercel → **Logs** da `[mail] … yuborilmadi: <sabab>` qatorini qidiring |
| “Pochta xizmati vaqtincha ishlamayapti” | Provayder javob bermadi; sabab Logs’da `[mail]` qatorida. Foydalanuvchi keyinroq “qayta yuborish” ni bosadi |

Xatlarning matni va havolalari **hech qachon logga yozilmaydi** — faqat mavzu va xato sababi.
