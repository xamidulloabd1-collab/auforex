import { z } from "zod";

const shortText = (max: number) => z.string().trim().max(max);
const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), "Havola https:// bilan boshlansin")
  .default("");

export const academySettingsSchema = z.object({
  name: shortText(80).min(2),
  platformName: shortText(80).min(2),
  slogan: shortText(120).min(2),
  telegramUrl: optionalUrl,
  contactEmail: z.union([z.literal(""), z.email().max(254)]).default(""),
});

export const homeSettingsSchema = z.object({
  heroTitle: shortText(120).min(2),
  heroSlogan: shortText(120).min(2),
  heroDescription: shortText(500).min(10),
  primaryCta: shortText(40).min(2),
  secondaryCta: shortText(40).min(2),
  welcomeTitle: shortText(120).min(2),
  welcomeText: shortText(5000).min(10),
  lessonsHeadline: shortText(80).min(2),
  lessonsDescription: shortText(300),
  libraryHeadline: shortText(80).min(2),
  libraryDescription: shortText(300),
  challengeHeadline: shortText(80).min(2),
  challengeDescription: shortText(300),
});

export const faqSettingsSchema = z.object({
  items: z
    .array(z.object({ question: shortText(200).min(3), answer: shortText(2000).min(3) }))
    .max(30),
});

export const footerSettingsSchema = z.object({
  about: shortText(400),
  disclaimer: shortText(1500).min(10),
  links: z.array(z.object({ label: shortText(40).min(1), href: shortText(300).min(1) })).max(12),
});

export const subscriptionSettingsSchema = z.object({
  /** Current PRO price in so‘m (shown next to the purchase button). */
  price: z.coerce.number().int().min(0).max(1_000_000_000),
  /** Optional previous price, shown struck through. */
  oldPrice: z.coerce.number().int().min(0).max(1_000_000_000).nullable(),
  currency: shortText(12).min(1),
  /** Optional period label, e.g. "oyiga". Empty = not shown. */
  period: shortText(30),
  /** Where "PRO sotib olish" sends the user (the founder's Telegram). */
  purchaseUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => /^https:\/\/[^\s]+$/.test(v), "Havola https:// bilan boshlansin"),
  purchaseButton: shortText(40).min(2),
  /** Default PRO duration when a request is approved (0 = until revoked). */
  defaultDurationDays: z.coerce.number().int().min(0).max(3650),
  headline: shortText(120).min(2),
  description: shortText(500),
  benefits: z.array(shortText(160).min(2)).min(1).max(12),
  comingSoonText: shortText(200).min(5),
  contactNote: shortText(300),
});

export const founderSettingsSchema = z.object({
  name: shortText(80),
  role: shortText(80),
  bio: shortText(3000),
  mission: shortText(1500),
  philosophy: shortText(1500),
  message: shortText(1500),
  portraitKey: z.string().nullable().default(null),
  socials: z.object({
    telegram: optionalUrl,
    instagram: optionalUrl,
    youtube: optionalUrl,
    website: optionalUrl,
  }),
});

export const accessSettingsSchema = z.object({
  tradingviewRequiresPro: z.boolean(),
});

export const SETTINGS_SCHEMAS = {
  academy: academySettingsSchema,
  home: homeSettingsSchema,
  faq: faqSettingsSchema,
  footer: footerSettingsSchema,
  subscription: subscriptionSettingsSchema,
  founder: founderSettingsSchema,
  access: accessSettingsSchema,
} as const;

export type SettingsKey = keyof typeof SETTINGS_SCHEMAS;
export type SettingsValue<K extends SettingsKey> = z.infer<(typeof SETTINGS_SCHEMAS)[K]>;

/** Welcome message supplied by the academy (kept verbatim). */
export const DEFAULT_WELCOME_TEXT = `Assalomu alaykum! AU Forex Academy platformasiga xush kelibsiz. Men ushbu platformani tradingni o‘rganishni istagan, o‘z oldiga katta maqsadlar qo‘ygan va kelajagi uchun harakat qilishga tayyor insonlar uchun yaratdim.

Bu yerda siz tradingni noldan boshlab o‘rganishingiz, yangi bilimlarga ega bo‘lishingiz, o‘z ustingizda ishlashingiz va trading yo‘lingizda bosqichma-bosqich rivojlanishingiz mumkin.

Ushbu platformada siz uchun 50 ga yaqin video darsliklar, tradingga oid foydali kitoblar, turli strategiyalar, bilim va tajribangizni oshirishga yordam beradigan materiallar jamlangan.

Tradingda muvaffaqiyatga erishish faqat grafiklarni o‘qish yoki strategiyani bilish bilan cheklanmaydi. Buning uchun sabr, intizom, to‘g‘ri fikrlash, riskni boshqarish va doimiy o‘rganish muhim.

Bizning yo‘limiz shunchaki darslarni ko‘rish bilan tugamaydi. O‘rganamiz, tahlil qilamiz, xatolarimizdan xulosa chiqaramiz va oldinga harakat qilamiz.

Platformamizda belgilangan shartlar asosida maxsus challenge va mukofotlar tizimi ham mavjud.

0 dan natijagacha — birga!`;

/** Founder profile supplied by the academy (editable in Admin → Founder). */
export const FOUNDER_PROFILE = {
  name: "Asadbek Uktambekov",
  role: "Founder of AU Forex Academy",
  bio: `Men Asadbek Uktambekov, Forex trading sohasida 3,5 yildan ortiq tajribaga ega trader va AU Forex Academy asoschisiman.

Natijalar va men haqimdagi ma’lumotlarni Instagram sahifamda ko‘rishingiz mumkin: @_uktambekovv`,
  mission:
    "AU Forex Academy’ni tashkil etishdan maqsadim — tradingni o‘rganmoqchi bo‘lgan insonlarga tizimli bilim, real tajriba va to‘g‘ri yondashuvni o‘rgatish, ularning o‘z ustida ishlashi va rivojlanishiga yordam berish.",
  philosophy: "",
  message:
    "Mening maqsadim — shunchaki traderlar tayyorlash emas, balki intizomli, bilimli va mustaqil qaror qabul qila oladigan traderlarni yetishtirish.",
  portraitKey: null,
  socials: {
    telegram: "https://t.me/aufx_academy",
    instagram: "https://www.instagram.com/_uktambekovv/",
    youtube: "",
    website: "",
  },
} satisfies z.infer<typeof founderSettingsSchema>;

export const DEFAULT_SETTINGS: { [K in SettingsKey]: SettingsValue<K> } = {
  academy: {
    name: "AU FOREX ACADEMY",
    platformName: "AU Forex Platform",
    slogan: "0 dan natijagacha — birga!",
    telegramUrl: "https://t.me/aufx_academy",
    contactEmail: "",
  },
  home: {
    heroTitle: "AU FOREX PLATFORM GA XUSH KELIBSIZ!",
    heroSlogan: "0 dan natijagacha — birga!",
    heroDescription:
      "AU Forex Academy — tradingni noldan o‘rganish, moliyaviy bozorlarni tushunish, risklarni boshqarish va bilimlaringizni bosqichma-bosqich rivojlantirish uchun yaratilgan ta’lim platformasi.",
    primaryCta: "O‘rganishni boshlash",
    secondaryCta: "PRO imkoniyatlarini ko‘rish",
    welcomeTitle: "AU Forex Academy’ga xush kelibsiz",
    welcomeText: DEFAULT_WELCOME_TEXT,
    lessonsHeadline: "50 ga yaqin videodarslik",
    lessonsDescription: "Tizimli video darslar orqali asoslardan amaliy tahlilgacha bosqichma-bosqich o‘rganing.",
    libraryHeadline: "Trading kutubxonasi",
    libraryDescription: "Tradingga oid kitoblar va o‘quv materiallarini platformaning o‘zida o‘qing.",
    challengeHeadline: "Challenge tizimi",
    challengeDescription: "Bilimga asoslangan challenge’larda qatnashing va tahliliy ko‘nikmalaringizni rivojlantiring.",
  },
  faq: {
    items: [
      {
        question: "AU Forex Academy kimlar uchun?",
        answer:
          "Tradingni noldan o‘rganmoqchi bo‘lganlar va bilimini tizimli ravishda mustahkamlamoqchi bo‘lganlar uchun. Materiallar asoslardan boshlanib, tahlil, risk management va trading psixologiyasigacha bosqichma-bosqich boradi.",
      },
      {
        question: "PRO obuna nimalarni ochib beradi?",
        answer:
          "PRO obuna barcha videodarsliklar, tradingga oid kitoblar va challenge’larda qatnashish imkoniyatini ochadi.",
      },
      {
        question: "PRO obunani qanday olaman?",
        answer:
          "Onlayn to‘lov tizimi tez orada ishga tushiriladi. Ungacha savollaringiz bo‘lsa, Telegram kanalimiz orqali bog‘laning.",
      },
      {
        question: "Platforma foyda kafolatlaydimi?",
        answer:
          "Yo‘q. Trading yuqori xavf bilan bog‘liq va hech qanday natija kafolatlanmaydi. Platforma ta’lim beradi, investitsiya maslahati bermaydi.",
      },
      {
        question: "Challenge’da qatnashish uchun real pul kiritish kerakmi?",
        answer:
          "Yo‘q. Challenge’lar ta’limiy faoliyat: testlar, grafik tahlili, risk hisob-kitoblari va demo-jurnal topshiriqlari. Real pul kiritish talab qilinmaydi.",
      },
      {
        question: "TradingView bo‘limidan kim foydalana oladi?",
        answer: "Ro‘yxatdan o‘tgan barcha foydalanuvchilar TradingView grafiklaridan foydalana oladi.",
      },
    ],
  },
  footer: {
    about:
      "AU Forex Academy — tradingni noldan o‘rganish, bozorni tushunish va riskni boshqarishga yo‘naltirilgan ta’lim platformasi.",
    disclaimer:
      "Risk haqida ogohlantirish: Forex va boshqa moliyaviy bozorlarda savdo qilish yuqori xavf bilan bog‘liq va kiritilgan mablag‘ning bir qismini yoki to‘liq yo‘qotilishiga olib kelishi mumkin. Platformadagi materiallar faqat ta’lim maqsadida taqdim etiladi va investitsiya maslahati hisoblanmaydi. O‘tgan natijalar kelajakdagi natijalarni kafolatlamaydi.",
    links: [
      { label: "Video darsliklar", href: "/lessons" },
      { label: "Kitoblar", href: "/books" },
      { label: "TradingView", href: "/tradingview" },
      { label: "Challenge", href: "/challenge" },
      { label: "PRO obuna", href: "/subscription" },
    ],
  },
  subscription: {
    price: 199_000,
    oldPrice: 1_200_000,
    currency: "so‘m",
    period: "",
    purchaseUrl: "https://t.me/uktambekovv",
    purchaseButton: "PRO sotib olish",
    defaultDurationDays: 0,
    headline: "PRO tarif",
    description:
      "PRO obuna AU Forex Academy’ning barcha ta’lim materiallarini ochadi: video darsliklar, kutubxona va challenge’lar.",
    benefits: ["Barcha videodarsliklar", "Foydali tradingga oid kitoblar", "Challenge’da qatnashish imkoniyati"],
    comingSoonText: "Onlayn to‘lov tizimi tez orada ishga tushiriladi. Hozircha to‘lov Telegram orqali qabul qilinadi.",
    contactNote: "To‘lov tasdiqlangach, PRO hisobingizda darhol ochiladi.",
  },
  founder: FOUNDER_PROFILE,
  access: {
    tradingviewRequiresPro: false,
  },
};
