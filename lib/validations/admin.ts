import { z } from "zod";
import { httpsUrl } from "./challenge";

const optionalSlug = z
  .string()
  .trim()
  .max(80)
  .refine((v) => v === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), "Slug faqat kichik lotin harflari, raqam va chiziqchadan iborat bo‘lsin");

const orderField = z.coerce.number().int().min(0).max(100_000);
const optionalId = z.string().trim().max(40);

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Nom kamida 2 ta belgi").max(60),
  kind: z.enum(["COURSE", "BOOK"]),
  order: orderField,
});

export const courseSchema = z.object({
  title: z.string().trim().min(3, "Sarlavha kamida 3 ta belgi").max(120),
  slug: optionalSlug,
  description: z.string().trim().max(2000),
  categoryId: optionalId,
  order: orderField,
  isPublished: z.boolean(),
});

export const lessonSchema = z
  .object({
    title: z.string().trim().min(3, "Sarlavha kamida 3 ta belgi").max(160),
    slug: optionalSlug,
    description: z.string().trim().max(5000),
    courseId: z.string().trim().min(1, "Kursni tanlang"),
    categoryId: z.string().trim().min(1, "Kategoriyani tanlang").max(40),
    /** Lesson number inside the course ("5-dars"). */
    order: z.coerce.number({ error: "Dars raqamini kiriting" }).int("Dars raqami butun son bo‘lsin").min(1, "Dars raqami 1 dan boshlanadi").max(10_000),
    level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).nullable(),
    isFree: z.boolean(),
    durationSeconds: z.coerce.number().int().min(0).max(60 * 60 * 24).nullable(),
    videoSource: z.enum(["UPLOAD", "EMBED"]),
    videoKey: z.string().nullable(),
    embedUrl: z.string().trim().max(500),
    thumbnailKey: z.string().nullable(),
    isPublished: z.boolean(),
  })
  .refine((v) => v.videoSource !== "EMBED" || v.embedUrl.length > 0, { path: ["embedUrl"], message: "Video havolasini kiriting" })
  .refine((v) => !v.isPublished || (v.videoSource === "UPLOAD" ? Boolean(v.videoKey) : v.embedUrl.length > 0), {
    path: ["isPublished"],
    message: "Nashr qilish uchun video kerak",
  });

export const bookSchema = z.object({
  title: z.string().trim().min(2, "Sarlavha kamida 2 ta belgi").max(160),
  slug: optionalSlug,
  author: z.string().trim().max(120),
  description: z.string().trim().max(3000),
  pageCount: z.coerce.number().int().min(1).max(10_000).nullable(),
  categoryId: optionalId,
  fileKey: z.string().min(1, "PDF faylni yuklang"),
  fileSize: z.coerce.number().int().min(1),
  coverKey: z.string().nullable(),
  order: orderField,
  isPublished: z.boolean(),
});

const listItems = z.array(z.string().trim().min(2).max(300)).max(20);

export const challengeSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    slug: optionalSlug,
    summary: z.string().trim().min(10, "Qisqa tavsif kamida 10 ta belgi").max(300),
    description: z.string().trim().min(20, "Tavsif kamida 20 ta belgi").max(10_000),
    type: z.enum(["QUIZ", "CHART_ANALYSIS", "RISK_ASSESSMENT", "DEMO_JOURNAL", "PSYCHOLOGY", "MARKET_ANALYSIS"]),
    objectives: listItems,
    requirements: listItems,
    startsAt: z.string().min(1, "Boshlanish vaqtini kiriting"),
    endsAt: z.string().min(1, "Tugash vaqtini kiriting"),
    maxScore: z.coerce.number().int().min(1).max(1000),
    passingScore: z.coerce.number().int().min(0).max(1000).nullable(),
    allowAttachment: z.boolean(),
    showLeaderboard: z.boolean(),
  })
  .refine((v) => v.passingScore == null || v.passingScore <= v.maxScore, { path: ["passingScore"], message: "O‘tish bali maksimal balldan oshmasin" });

export const questionSchema = z
  .object({
    prompt: z.string().trim().min(3).max(2000),
    options: z.array(z.string().trim().min(1, "Variant bo‘sh bo‘lmasin").max(300)).min(2, "Kamida 2 ta variant").max(6),
    correctIndex: z.coerce.number().int().min(0),
    explanation: z.string().trim().max(2000),
    points: z.coerce.number().int().min(1).max(100),
  })
  .refine((q) => q.correctIndex < q.options.length, { path: ["correctIndex"], message: "To‘g‘ri javobni tanlang" });

export const questionsSchema = z.object({ questions: z.array(questionSchema).max(100) });

export const rewardSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().max(2000),
    eligibility: z.string().trim().min(5, "Shartlarni aniq yozing").max(2000),
    rankFrom: z.coerce.number().int().min(1).max(10_000).nullable(),
    rankTo: z.coerce.number().int().min(1).max(10_000).nullable(),
    order: orderField,
    isPublished: z.boolean(),
  })
  .refine((r) => r.rankTo == null || r.rankFrom != null, { path: ["rankFrom"], message: "Boshlang‘ich o‘rinni kiriting" })
  .refine((r) => r.rankFrom == null || r.rankTo == null || r.rankTo >= r.rankFrom, { path: ["rankTo"], message: "Oraliq noto‘g‘ri" });

export const reviewSchema = z.object({
  status: z.enum(["REVIEWED", "REJECTED"]),
  score: z.coerce.number().int().min(0).max(1000).nullable(),
  feedback: z.string().trim().max(2000),
});

export const grantProSchema = z.object({
  expiresAt: z.string().trim(),
  note: z.string().trim().max(500),
});

export { httpsUrl };
