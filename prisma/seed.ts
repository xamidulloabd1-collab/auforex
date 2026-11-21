/**
 * Idempotent seed: categories, achievements, default site settings, the admin
 * account (from env) and the three supplied PDF books (original files, unchanged).
 *
 * Run: npm run db:seed
 */
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createScriptPrisma, ensureAdmin, generatePassword } from "./seed-helpers";
import { DEFAULT_SETTINGS, FOUNDER_PROFILE } from "../lib/settings/schema";
import { SUGGESTED_COURSE_CATEGORIES } from "../lib/constants";
import { slugify } from "../lib/utils";

const prisma = createScriptPrisma();
const ASSETS = path.join(process.cwd(), "prisma", "seed-assets");
const STORAGE_ROOT = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_ROOT || "./storage");

const BOOK_CATEGORIES = ["Trading asoslari", "Texnik tahlil", "Trading psixologiyasi"];

const ACHIEVEMENTS = [
  { code: "FIRST_LESSON", title: "Birinchi qadam", description: "Birinchi darsni yakunladingiz", icon: "footprints" },
  { code: "TEN_LESSONS", title: "Izchil o‘quvchi", description: "10 ta darsni yakunladingiz", icon: "flame" },
  { code: "FIRST_BOOK", title: "Kitobxon", description: "Birinchi kitobni oxirigacha o‘qidingiz", icon: "book-open-check" },
  { code: "FIRST_CHALLENGE", title: "Challenge ishtirokchisi", description: "Birinchi challenge topshirig‘ini yubordingiz", icon: "flag" },
  { code: "PERFECT_QUIZ", title: "Bilimdon", description: "Bilim testida maksimal ball oldingiz", icon: "target" },
  { code: "CHALLENGE_PASSED", title: "Muvaffaqiyatli natija", description: "Challenge’ni muvaffaqiyatli yakunladingiz", icon: "badge-check" },
  { code: "CHALLENGE_WINNER", title: "Challenge g‘olibi", description: "Challenge g‘oliblari qatoriga kirdingiz", icon: "trophy" },
];

/** Original supplied books. Metadata is taken from the PDFs themselves. */
const BOOKS = [
  {
    slug: "bozorni-zabt-etish-1-kitob",
    title: "Bozorni zabt etish — 1-kitob",
    author: null, // the PDF metadata has no real author name
    file: "bozorni-zabt-etish-1-kitob.pdf",
    cover: null,
    pageCount: 29,
    category: "Texnik tahlil",
    order: 1,
    description:
      "10 ta darsdan iborat kirish kitobi: zonalar va qayta sinovlar, likvidlik, institutsional taklif va talab, institutsional shamchalar, risk/reward, trading psixologiyasi hamda ko‘pchilik treyderlar nega yo‘qotishi haqida.",
  },
  {
    slug: "bozorni-zabt-etish-2-kitob",
    title: "Bozorni zabt etish — 2-kitob",
    author: null,
    file: "bozorni-zabt-etish-2-kitob.pdf",
    cover: null,
    pageCount: 46,
    category: "Texnik tahlil",
    order: 2,
    description:
      "Ikkinchi kitobning to‘liq varianti: ehtimollar asosida fikrlash, risk qoidalari, likvidlik va uni aniqlash usullari (double top/bottom, doji, wick, trendline) hamda retail treyderlar naqshlarini tushunish.",
  },
  {
    slug: "trading-noldan",
    title: "Trading Noldan",
    author: "Shokhake",
    file: "trading-noldan-shokhake.pdf",
    cover: "trading-noldan-shokhake.webp",
    pageCount: 178,
    category: "Trading asoslari",
    order: 3,
    description:
      "0 dan boshlab tradingni o‘rganish. Bozor qanday ishlaydi: strategiyagacha bo‘lgan barcha asoslar — moliyaviy bozorlar, Forex, savdo sessiyalari, broker, Bid/Ask, spred, pip va lot, leveraj, buyurtma turlari, grafiklar, bozor tuzilishi va fundamental tahlil asoslari.",
  },
];

function storageKey(area: string, ext: string) {
  return `${area}/${crypto.randomUUID().replace(/-/g, "")}.${ext}`;
}

async function copyIntoStorage(src: string, area: string, ext: string) {
  const key = storageKey(area, ext);
  const dest = path.join(STORAGE_ROOT, key);
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(src, dest);
  return key;
}

async function seedCategories() {
  for (const [i, name] of SUGGESTED_COURSE_CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { kind_slug: { kind: "COURSE", slug: slugify(name) } },
      update: {},
      create: { kind: "COURSE", name, slug: slugify(name), order: i },
    });
  }
  for (const [i, name] of BOOK_CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { kind_slug: { kind: "BOOK", slug: slugify(name) } },
      update: {},
      create: { kind: "BOOK", name, slug: slugify(name), order: i },
    });
  }
}

async function seedAchievements() {
  for (const a of ACHIEVEMENTS) {
    await prisma.achievement.upsert({ where: { code: a.code }, update: { title: a.title, description: a.description, icon: a.icon }, create: a });
  }
}

async function seedSettings() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const exists = await prisma.siteSetting.findUnique({ where: { key } });
    if (!exists) await prisma.siteSetting.create({ data: { key, value: value as object } });
  }
}

/** Fills the founder profile on installs where it is still empty (never overwrites edits). */
async function seedFounderProfile() {
  const row = await prisma.siteSetting.findUnique({ where: { key: "founder" } });
  const current = (row?.value ?? {}) as Partial<typeof FOUNDER_PROFILE>;
  if (current.name) return false;
  const value = { ...FOUNDER_PROFILE, portraitKey: current.portraitKey ?? null };
  await prisma.siteSetting.upsert({ where: { key: "founder" }, update: { value }, create: { key: "founder", value } });
  return true;
}

/** The founder's SUPER_ADMIN account (signs in with a login, e.g. "asadbek"). */
async function seedFounderAccount() {
  const username = (process.env.FOUNDER_USERNAME || "asadbek").trim().toLowerCase();
  const email = (process.env.FOUNDER_EMAIL || "founder@auforex.local").trim().toLowerCase();
  const exists = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] }, select: { id: true } });
  let password = process.env.FOUNDER_PASSWORD;
  let generated = false;
  if (!exists && !password) {
    password = generatePassword();
    generated = true;
  }
  const res = await ensureAdmin(prisma, { email, username, password, name: process.env.FOUNDER_NAME || FOUNDER_PROFILE.name, role: "SUPER_ADMIN" });
  console.log(`✓ founder super admin "${username}" ${res.created ? "created" : "ensured"}`);
  if (generated) {
    console.log(`  ⚠ Generated password (shown once — store it safely and change it after first login): ${password}`);
  }
}

async function seedBooks() {
  for (const book of BOOKS) {
    const existing = await prisma.book.findUnique({ where: { slug: book.slug } });
    if (existing) {
      console.log(`  • ${book.title}: already present, skipped`);
      continue;
    }
    const pdfPath = path.join(ASSETS, "books", book.file);
    const head = (await readFile(pdfPath)).subarray(0, 5).toString("latin1");
    if (head !== "%PDF-") throw new Error(`${book.file} is not a PDF`);
    const { size } = await stat(pdfPath);
    const fileKey = await copyIntoStorage(pdfPath, "books", "pdf");
    const coverKey = book.cover ? await copyIntoStorage(path.join(ASSETS, "covers", book.cover), "covers", "webp") : null;
    const category = await prisma.category.findUnique({
      where: { kind_slug: { kind: "BOOK", slug: slugify(book.category) } },
    });
    await prisma.book.create({
      data: {
        slug: book.slug,
        title: book.title,
        author: book.author,
        description: book.description,
        pageCount: book.pageCount,
        fileKey,
        fileSize: size,
        coverKey,
        order: book.order,
        categoryId: category?.id ?? null,
        // Supplied by the platform owner for this platform — published by default.
        // Unpublish in Admin → Kitoblar if distribution rights are not confirmed.
        isPublished: true,
        publishedAt: new Date(),
      },
    });
    console.log(`  • ${book.title}: added (${Math.round(size / 1024)} KB)`);
  }
}

async function main() {
  console.log("Seeding AU Forex Academy…");
  await seedCategories();
  console.log("✓ categories");
  await seedAchievements();
  console.log("✓ achievements");
  await seedSettings();
  console.log("✓ site settings (defaults, existing values kept)");
  if (await seedFounderProfile()) console.log("✓ founder profile filled");
  await seedFounderAccount();

  console.log("Books:");
  await seedBooks();
  // Optional extra super admin. Never blocks the essential data above/below.
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  if (adminEmail) {
    try {
      const res = await ensureAdmin(prisma, {
        email: adminEmail,
        password: process.env.ADMIN_PASSWORD || undefined,
        name: process.env.ADMIN_NAME,
      });
      console.log(`✓ admin ${adminEmail} ${res.created ? "created" : "ensured (existing user promoted)"}`);
    } catch (err) {
      console.log(`! ADMIN_EMAIL=${adminEmail} skipped: ${err instanceof Error ? err.message : String(err)}`);
      console.log("  (set ADMIN_PASSWORD, or leave ADMIN_EMAIL empty if the founder is the only admin)");
    }
  }

  console.log("✓ done");
}

main()
  .catch((err) => {
    const text = `${String(err)} ${JSON.stringify(err, Object.getOwnPropertyNames(err ?? {}))}`;
    if (/TableDoesNotExist|P2021|does not exist in the current database/i.test(text)) {
      console.error("\n✗ Jadvallar hali yaratilmagan. Avval bajaring:  npx prisma migrate deploy   so‘ng qayta:  npm run db:seed\n");
    } else if (/P1000|AuthenticationFailed|password authentication failed/i.test(text)) {
      console.error("\n✗ PostgreSQL login/parolni qabul qilmadi (DATABASE_URL). Avtomatik tuzatish:  npm run db:fix\n");
    } else if (/ECONNREFUSED|P1001|Can't reach database/i.test(text)) {
      console.error("\n✗ PostgreSQL’ga ulanib bo‘lmadi. Avtomatik tuzatish:  npm run db:fix\n");
    } else {
      console.error(err);
    }
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
