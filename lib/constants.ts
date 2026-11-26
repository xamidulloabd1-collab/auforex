export const MAIN_NAV = [
  { href: "/", label: "Bosh sahifa" },
  { href: "/lessons", label: "Video darsliklar" },
  { href: "/books", label: "Kitoblar" },
  { href: "/tradingview", label: "TradingView" },
  { href: "/challenge", label: "Challenge" },
  { href: "/founder", label: "Founder" },
  { href: "/dashboard", label: "Shaxsiy kabinet" },
] as const;

export const DASHBOARD_NAV = [
  { href: "/dashboard", label: "Umumiy ko‘rinish", icon: "layout" },
  { href: "/dashboard/learning", label: "Mening darslarim", icon: "play" },
  { href: "/dashboard/books", label: "Mening kitoblarim", icon: "book" },
  { href: "/dashboard/challenges", label: "Mening challenge’larim", icon: "trophy" },
  { href: "/dashboard/subscription", label: "Obuna", icon: "crown" },
  { href: "/dashboard/settings", label: "Profil sozlamalari", icon: "settings" },
] as const;

/** The single management panel (SUPER_ADMIN only). */
export const ADMIN_NAV = [
  { href: "/super-admin", label: "Umumiy", icon: "layout" },
  { href: "/super-admin/requests", label: "PRO arizalari", icon: "inbox" },
  { href: "/super-admin/users", label: "Foydalanuvchilar", icon: "users" },
  { href: "/super-admin/courses", label: "Kurslar", icon: "layers" },
  { href: "/super-admin/lessons", label: "Video darslar", icon: "play" },
  { href: "/super-admin/categories", label: "Kategoriyalar", icon: "tags" },
  { href: "/super-admin/books", label: "Kitoblar", icon: "book" },
  { href: "/super-admin/challenges", label: "Challenge’lar", icon: "trophy" },
  { href: "/super-admin/team", label: "Super adminlar", icon: "crown" },
  { href: "/super-admin/founder", label: "Founder", icon: "user" },
  { href: "/super-admin/settings", label: "Sayt sozlamalari", icon: "settings" },
  { href: "/super-admin/audit", label: "Audit jurnali", icon: "shield" },
] as const;

export const SUGGESTED_COURSE_CATEGORIES = [
  "Trading asoslari",
  "Forex bozori",
  "Texnik tahlil",
  "Fundamental tahlil",
  "Risk management",
  "Trading psixologiyasi",
  "Strategiyalar",
  "Amaliy tahlillar",
] as const;

export const CHALLENGE_TYPE_LABELS = {
  QUIZ: "Bilim testi",
  CHART_ANALYSIS: "Grafik tahlili",
  RISK_ASSESSMENT: "Risk management",
  DEMO_JOURNAL: "Demo trading jurnali",
  PSYCHOLOGY: "Trading psixologiyasi",
  MARKET_ANALYSIS: "Bozor tahlili",
} as const;

export const CHALLENGE_STATUS_LABELS = {
  DRAFT: "Qoralama",
  PUBLISHED: "E’lon qilingan",
  CLOSED: "Yopilgan",
  RESULTS_PUBLISHED: "Natijalar e’lon qilingan",
} as const;

export const SUBMISSION_STATUS_LABELS = {
  PENDING: "Ko‘rib chiqilmoqda",
  REVIEWED: "Baholandi",
  REJECTED: "Qabul qilinmadi",
} as const;

export const OUTCOME_LABELS = {
  PARTICIPANT: "Ishtirokchi",
  PASSED: "Muvaffaqiyatli",
  WINNER: "G‘olib",
} as const;

export const EXPERIENCE_LABELS = {
  BEGINNER: "Boshlovchi",
  INTERMEDIATE: "O‘rta",
  ADVANCED: "Tajribali",
} as const;

/** Hosts allowed for externally embedded lesson videos. */
export const VIDEO_EMBED_HOSTS = [
  "www.youtube-nocookie.com",
  "www.youtube.com",
  "player.vimeo.com",
  "iframe.mediadelivery.net",
  "player.mediadelivery.net",
] as const;

/** Lesson difficulty labels (Lesson.level). */
export const LEVEL_LABELS = { BEGINNER: "Boshlang‘ich", INTERMEDIATE: "O‘rta", ADVANCED: "Yuqori" } as const;

/**
 * Avatars and challenge screenshots are sent to the app in one request; Vercel accepts at most
 * 4.5 MB per request body, so the browser stops anything over 4 MB before sending it.
 */
export const MAX_SINGLE_REQUEST_IMAGE_BYTES = 4 * 1024 * 1024;
