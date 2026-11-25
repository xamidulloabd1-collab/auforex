import path from "node:path";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

/**
 * Full platform walkthrough covering the QA scenarios from the specification.
 * Runs serially: later steps rely on content and users created by earlier ones.
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@auforex.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe-Admin-2026!";
const FOUNDER_LOGIN = process.env.E2E_FOUNDER_LOGIN ?? "asadbek";
const FOUNDER_PASSWORD = process.env.E2E_FOUNDER_PASSWORD ?? "";
const RUN = Date.now().toString(36);
const PASSWORD = "Trader2026x";
const FREE = { name: "Free Tester", email: `free-${RUN}@example.com` };
const PRO = { name: "Pro Tester", email: `pro-${RUN}@example.com` };
const COURSE_TITLE = `E2E kurs ${RUN}`;
const LESSON_TITLE = `E2E dars ${RUN}`;
const CHALLENGE_TITLE = `E2E test challenge ${RUN}`;
const SAMPLE_VIDEO = path.join(__dirname, "..", "fixtures", "sample.mp4");
const TELEGRAM_URL = "https://t.me/uktambekovv";
/** Prices are rendered with narrow no-break spaces; compare digits only. */
const digits = (s: string | null) => (s ?? "").replace(/\D/g, "");

let admin: BrowserContext;
let founder: BrowserContext;
let free: BrowserContext;
let pro: BrowserContext;
let lessonVideoUrl = "";
let bookFileUrl = "";
let challengeUrl = "";
let challengeId = "";

async function newContext(browser: Browser, opts: Parameters<Browser["newContext"]>[0] = {}) {
  return browser.newContext({ ...opts });
}

async function register(page: Page, name: string, email: string) {
  await page.goto("/register");
  await page.getByLabel("Ism va familiya").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Parol", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Parolni tasdiqlang").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Ro‘yxatdan o‘tish" }).click();
  await page.waitForURL("**/dashboard");
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email yoki login").fill(email);
  await page.getByLabel("Parol", { exact: true }).fill(password);
  await page.getByTestId("login-form").getByRole("button", { name: "Kirish" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test.describe.serial("AU Forex Academy — QA scenarios", () => {
  test.beforeAll(async ({ browser }) => {
    admin = await newContext(browser);
    founder = await newContext(browser);
    free = await newContext(browser);
    pro = await newContext(browser);
  });

  test.afterAll(async () => {
    await Promise.all([admin?.close(), founder?.close(), free?.close(), pro?.close()]);
  });

  test("1. Guest opens the homepage", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AU FOREX PLATFORM GA XUSH KELIBSIZ!");
    await expect(page.getByText("0 dan natijagacha — birga!").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "O‘rganishni boshlash" }).first()).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Asosiy navigatsiya" });
    for (const label of ["Bosh sahifa", "Video darsliklar", "Kitoblar", "TradingView", "Challenge", "Founder", "Shaxsiy kabinet"]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
    await expect(page.getByTestId("footer-disclaimer")).toContainText("Risk haqida ogohlantirish");
    await expect(page.getByTestId("bottom-nav")).toBeHidden();
    // Price is shown next to the PRO purchase button on the homepage.
    const homePrice = page.getByTestId("price-tag").first();
    expect(digits(await homePrice.getByTestId("old-price").textContent())).toBe("1200000");
    expect(digits(await homePrice.getByTestId("current-price").textContent())).toBe("199000");
    // Guests are asked to sign up first so the request can be matched to an account.
    await page.goto("/subscription");
    await expect(page.getByTestId("buy-pro-guest")).toBeVisible();
    await expect(page.getByTestId("buy-pro")).toHaveCount(0);
    const csp = (await page.request.get("/")).headers()["content-security-policy"];
    expect(csp).toContain("frame-ancestors 'none'");
  });

  test("2. Users register successfully (duplicate email is rejected)", async () => {
    const p1 = await free.newPage();
    await register(p1, FREE.name, FREE.email);
    await expect(p1.getByTestId("dashboard-plan")).toContainText("Bepul");

    const p2 = await pro.newPage();
    await register(p2, PRO.name, PRO.email);

    const guest = await p1.context().browser()!.newContext();
    const g = await guest.newPage();
    await g.goto("/register");
    await g.getByLabel("Ism va familiya").fill("Dup User");
    await g.getByLabel("Email").fill(FREE.email);
    await g.getByLabel("Parol", { exact: true }).fill(PASSWORD);
    await g.getByLabel("Parolni tasdiqlang").fill(PASSWORD);
    await g.getByRole("checkbox").check();
    await g.getByRole("button", { name: "Ro‘yxatdan o‘tish" }).click();
    await expect(g.getByRole("alert").first()).toContainText("allaqachon mavjud");
    await guest.close();
  });

  test("3. User logs out and logs in", async () => {
    const page = await free.newPage();
    await page.goto("/dashboard");
    await page.getByTestId("user-menu-trigger").click();
    await page.getByTestId("logout-button").click();
    await page.waitForURL((u) => u.pathname === "/");
    await page.goto("/dashboard");
    await page.waitForURL("**/login**");
    // wrong password is rejected
    await page.getByLabel("Email yoki login").fill(FREE.email);
    await page.getByLabel("Parol", { exact: true }).fill("Wrong-pass-1");
    await page.getByTestId("login-form").getByRole("button", { name: "Kirish" }).click();
    await expect(page.getByRole("alert").first()).toContainText("Email yoki parol noto‘g‘ri");
    await login(page, FREE.email, PASSWORD);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("15a. Admin creates a course, uploads a lesson video and publishes it", async () => {
    const page = await admin.newPage();
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto("/super-admin/courses");
    await page.getByTestId("new-course").click();
    await page.getByTestId("course-title").fill(COURSE_TITLE);
    await page.getByRole("dialog").getByRole("switch").click();
    await page.getByRole("dialog").getByRole("button", { name: "Saqlash" }).click();
    await expect(page.getByRole("cell", { name: COURSE_TITLE }).first()).toBeVisible();

    await page.goto("/super-admin/lessons/new");
    await page.getByTestId("lesson-title").fill(LESSON_TITLE);
    await page.getByTestId("lesson-course").selectOption({ label: COURSE_TITLE });
    await page.getByTestId("lesson-category").selectOption({ label: "Texnik tahlil" });
    await page.getByTestId("video-upload").setInputFiles(SAMPLE_VIDEO);
    await expect(page.getByText("Video yuklangan")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("lesson-publish").click();
    await page.getByTestId("lesson-save").click();
    await page.waitForURL("**/super-admin/lessons");
    await expect(page.getByRole("cell", { name: new RegExp(LESSON_TITLE) }).first()).toBeVisible();
  });

  test("15b. Admin creates and publishes a quiz challenge", async () => {
    const page = await admin.newPage();
    await page.goto("/super-admin/challenges/new");
    await page.getByTestId("challenge-title").fill(CHALLENGE_TITLE);
    await page.getByTestId("challenge-summary").fill("Trading asoslari bo‘yicha qisqa bilim testi.");
    await page.getByTestId("challenge-description").fill("Ushbu test trading asoslarini qanchalik tushunganingizni tekshiradi. Real pul talab qilinmaydi.");
    await page.getByTestId("challenge-start").fill("2026-01-01T00:00");
    await page.getByTestId("challenge-end").fill("2030-01-01T00:00");
    await page.getByTestId("challenge-save").click();
    await page.waitForURL(/\/super-admin\/challenges\/[a-z0-9]+$/);
    challengeId = page.url().split("/").pop()!;

    await page.getByTestId("add-question").click();
    await page.getByPlaceholder("Savol matni").fill("Stop-loss nima uchun ishlatiladi?");
    await page.getByPlaceholder("1-variant").fill("Zararni cheklash uchun");
    await page.getByPlaceholder("2-variant").fill("Foydani kafolatlash uchun");
    await page.getByLabel("1-variant to‘g‘ri").check();
    await page.getByTestId("save-questions").click();
    await expect(page.getByText("Savollar saqlandi")).toBeVisible();

    await page.getByTestId("publish-challenge").click();
    await page.getByTestId("publish-challenge-confirm").click();
    await expect(page.getByTestId("challenge-status")).toHaveText("E’lon qilingan");
    challengeUrl = await page.getByRole("link", { name: "Ko‘rish" }).getAttribute("href").then((h) => h!);
  });

  test("4-7. FREE user sees the PRO gate with the price; “PRO sotib olish” opens Telegram and files a request", async () => {
    const page = await free.newPage();
    await page.goto("/lessons");
    const gate = page.getByTestId("pro-access-gate");
    await expect(gate.getByRole("heading")).toHaveText("Ushbu bo‘limlar uchun PRO tarifga obuna bo‘lishingiz kerak");
    for (const b of ["Barcha videodarsliklar", "Foydali tradingga oid kitoblar", "Challenge’da qatnashish imkoniyati"]) {
      await expect(gate.getByText(b)).toBeVisible();
    }
    expect(digits(await gate.getByTestId("old-price").textContent())).toBe("1200000");
    expect(digits(await gate.getByTestId("current-price").textContent())).toBe("199000");
    // PRO lessons are listed for FREE users, but locked — and no video link reaches the page.
    const lockedCard = page.getByTestId("lesson-card").filter({ hasText: LESSON_TITLE });
    await expect(lockedCard).toHaveAttribute("data-lock-reason", "pro");
    await lockedCard.click();
    await expect(page.getByTestId("lesson-pro-locked")).toBeVisible();
    await expect(page.locator("video, iframe")).toHaveCount(0);

    await page.goto("/books");
    await expect(page.getByTestId("pro-access-gate")).toBeVisible();
    await expect(page.getByTestId("book-card")).toHaveCount(0);

    await page.goto("/lessons");
    await page.getByTestId("subscribe-button").click();
    await page.waitForURL("**/subscription");
    await expect(page.getByTestId("subscription-status")).toContainText("Bepul");
    const card = page.getByTestId("purchase-card");
    expect(digits(await card.getByTestId("old-price").textContent())).toBe("1200000");
    expect(digits(await card.getByTestId("current-price").textContent())).toBe("199000");
    const buy = card.getByTestId("buy-pro");
    await expect(buy).toHaveAttribute("href", TELEGRAM_URL);
    await expect(buy).toHaveAttribute("target", "_blank");

    // Telegram is outside the test network — answer it locally.
    await free.route("https://t.me/**", (route) => route.fulfill({ contentType: "text/html", body: "<title>Telegram</title>" }));
    const [popup] = await Promise.all([page.waitForEvent("popup"), buy.click()]);
    await popup.waitForURL(TELEGRAM_URL);
    await popup.close();
    await expect(page.getByTestId("pro-request-sent")).toBeVisible();
    // Clicking does not unlock anything by itself.
    await page.goto("/dashboard/subscription");
    await expect(page.getByTestId("subscription-badge")).toHaveText("Bepul");
    await expect(page.getByTestId("pending-request-note")).toBeVisible();
    await page.goto("/lessons");
    await expect(page.getByTestId("pro-access-gate")).toBeVisible();
  });

  test("9. Admin grants PRO to a user", async () => {
    const page = await admin.newPage();
    await page.goto(`/super-admin/users?q=${encodeURIComponent(PRO.email)}`);
    await page.getByTestId("admin-user-row").first().click();
    await page.waitForURL(/\/super-admin\/users\/.+/);
    await page.getByTestId("grant-pro").click();
    await expect(page.getByTestId("admin-sub-status")).toHaveText("PRO faol");
  });

  test("10-11. PRO user watches a lesson (range streaming) and progress is tracked", async () => {
    const page = await pro.newPage();
    await page.goto("/lessons");
    await expect(page.getByTestId("pro-access-gate")).toHaveCount(0);
    await page.getByTestId("lesson-card").filter({ hasText: LESSON_TITLE }).click();
    await page.waitForURL(/\/lessons\/.+/);
    const video = page.getByTestId("lesson-video");
    await expect(video).toBeVisible();
    lessonVideoUrl = (await video.getAttribute("src"))!;
    expect(lessonVideoUrl).toMatch(/^\/api\/lessons\/[a-z0-9]+\/video$/);

    // Local disk: the app streams the range itself. Object storage (E2E_S3=1, like Vercel): the app
    // answers with a no-store redirect to a short-lived bucket link, and the bucket serves the range.
    const first = await page.request.get(lessonVideoUrl, { headers: { Range: "bytes=0-1023" }, maxRedirects: 0 });
    expect(first.headers()["cache-control"]).toContain("no-store");
    const partial = process.env.E2E_S3 === "1" ? await page.request.get(first.headers().location!, { headers: { Range: "bytes=0-1023" } }) : first;
    if (process.env.E2E_S3 === "1") expect(first.status()).toBe(302);
    expect(partial.status()).toBe(206);
    expect(partial.headers()["content-range"]).toMatch(/^bytes 0-1023\/\d+$/);

    await expect(page.getByTestId("lesson-status")).toHaveText("Dars hali yakunlanmagan");
    await page.getByTestId("mark-complete").click();
    await expect(page.getByTestId("lesson-status")).toHaveText("Dars yakunlangan");

    await page.goto("/lessons");
    await expect(page.getByTestId("learning-progress")).toContainText("100%");
    await page.goto("/dashboard/learning");
    await expect(page.getByText(LESSON_TITLE).first()).toBeVisible();
  });

  test("12. PRO user opens an authorised PDF in the reader", async () => {
    const page = await pro.newPage();
    await page.goto("/books");
    const card = page.getByTestId("book-card").filter({ hasText: "Trading Noldan" });
    await expect(card).toContainText("Shokhake");
    const fileReq = page.waitForRequest((r) => /\/api\/books\/[a-z0-9]+\/file/.test(r.url()));
    await card.getByRole("link", { name: /O‘qish|Davom ettirish/ }).click();
    bookFileUrl = new URL((await fileReq).url()).pathname;
    const reader = page.getByTestId("pdf-reader");
    await expect(reader.getByText("/ 178").filter({ visible: true })).toBeVisible({ timeout: 30_000 });
    await expect(reader.locator("canvas")).toBeVisible();
    await page.getByTestId("next-page").click();
    await expect(page.getByTestId("page-input")).toHaveValue("2");
    await page.waitForTimeout(1800); // debounced progress save
    await page.goto("/dashboard/books");
    await expect(page.getByText("2-bet").first()).toBeVisible();
  });

  test("8. FREE users and guests cannot fetch protected files by direct URL", async ({ browser }) => {
    expect(lessonVideoUrl && bookFileUrl).toBeTruthy();
    const page = await free.newPage();
    expect((await page.request.get(lessonVideoUrl)).status()).toBe(403);
    expect((await page.request.get(bookFileUrl)).status()).toBe(403);

    const guest = await browser.newContext();
    const g = await guest.newPage();
    expect((await g.request.get(lessonVideoUrl)).status()).toBe(401);
    expect((await g.request.get(bookFileUrl)).status()).toBe(401);
    // Private storage areas are never served by the public media route.
    expect((await g.request.get(`/api/media/books/${"a".repeat(32)}.pdf`)).status()).toBe(404);
    expect((await g.request.get("/storage/books/x.pdf")).status()).toBe(404);
    await guest.close();
  });

  test("13. FREE user cannot take part in a PRO challenge; PRO user can", async () => {
    const page = await free.newPage();
    await page.goto(challengeUrl);
    await expect(page.getByTestId("pro-access-gate")).toBeVisible();
    await expect(page.getByTestId("quiz-form")).toHaveCount(0);
    const res = await page.request.post(`/api/challenges/${challengeId}/submission`, {
      multipart: { answers: "{}" },
      headers: { Origin: new URL(page.url()).origin },
    });
    expect(res.status()).toBe(403);

    const p = await pro.newPage();
    await p.goto(challengeUrl);
    await p.getByText("Zararni cheklash uchun").click();
    await p.getByRole("button", { name: "Testni yakunlash" }).click();
    await expect(p.getByTestId("submission-status")).toContainText("100");
    await p.goto("/dashboard/challenges");
    await expect(p.getByText(CHALLENGE_TITLE)).toBeVisible();
    await expect(p.getByLabel("Bilimdon — qo‘lga kiritilgan")).toBeVisible();
  });

  test("14. Non-admins cannot access admin routes or APIs", async ({ browser }) => {
    const page = await free.newPage();
    const res = await page.goto("/super-admin");
    expect(res?.status()).toBe(404);
    expect((await page.goto("/superadmin"))?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Sahifa topilmadi" })).toBeVisible();
    const upload = await page.request.put("/api/admin/upload?kind=book", {
      data: Buffer.from("%PDF-1.4 fake"),
      headers: { Origin: new URL(page.url()).origin, "Content-Type": "application/pdf" },
    });
    expect(upload.status()).toBe(403);

    const guest = await browser.newContext();
    const g = await guest.newPage();
    await g.goto("/super-admin/users");
    await expect(g).toHaveURL(/\/login\?next=%2Fsuper-admin/);
    // Old and mistyped panel addresses lead to /super-admin (guests → login).
    for (const legacy of ["/admin", "/superadmin", "/super_admin", "/admin/users"]) {
      await g.goto(legacy);
      await expect(g).toHaveURL(/\/login\?next=%2Fsuper-admin/);
    }
    const anonUpload = await g.request.put("/api/admin/upload?kind=book", {
      data: Buffer.from("%PDF-1.4 fake"),
      headers: { Origin: new URL(g.url()).origin },
    });
    expect(anonUpload.status()).toBe(401);
    await guest.close();
  });

  test("15c. Admin unpublishes content, edits the founder profile and revokes PRO", async () => {
    const page = await admin.newPage();
    await page.goto("/super-admin/lessons");
    const row = page.getByRole("row").filter({ hasText: LESSON_TITLE });
    await row.getByRole("switch").click();
    await expect(page.getByText("Nashrdan olindi")).toBeVisible();

    const p = await pro.newPage();
    await p.goto("/lessons");
    await expect(p.getByText(LESSON_TITLE)).toHaveCount(0);
    expect((await p.request.get(lessonVideoUrl)).status()).toBe(404);

    await page.goto(`/super-admin/users?q=${encodeURIComponent(PRO.email)}`);
    await page.getByTestId("admin-user-row").first().click();
    await page.getByTestId("revoke-pro").click();
    await page.getByTestId("revoke-pro-confirm").click();
    await expect(page.getByTestId("admin-sub-status")).toHaveText("PRO bekor qilingan");
    await p.goto("/books");
    await expect(p.getByTestId("pro-access-gate")).toBeVisible();
    expect((await p.request.get(bookFileUrl)).status()).toBe(403);
  });

  test("Super admin: founder signs in with a login and manages the team, founder profile and audit log", async () => {
    expect(FOUNDER_PASSWORD, "set E2E_FOUNDER_PASSWORD").toBeTruthy();
    const page = await founder.newPage();
    await login(page, FOUNDER_LOGIN, FOUNDER_PASSWORD);
    await page.goto("/super-admin");
    await expect(page.getByTestId("admin-role-badge")).toHaveText("Super admin");
    // Typing the address without the hyphen still opens the panel.
    await page.goto("/superadmin");
    await expect(page).toHaveURL(/\/super-admin$/);
    const nav = page.getByRole("navigation", { name: "Super admin bo‘limlari" });
    for (const item of ["PRO arizalari", "Foydalanuvchilar", "Super adminlar", "Founder", "Sayt sozlamalari", "Audit jurnali"]) {
      await expect(nav.getByRole("link", { name: item }).first()).toBeAttached();
    }

    // Founder profile (supplied content) is published and editable by the super admin only.
    const visitor = await page.context().browser()!.newContext();
    const v = await visitor.newPage();
    await v.goto("/founder");
    await expect(v.getByRole("heading", { level: 1 })).toHaveText("Asadbek Uktambekov");
    await expect(v.getByText("3,5 yildan ortiq tajribaga ega trader")).toBeVisible();
    await expect(v.getByText("intizomli, bilimli va mustaqil qaror")).toBeVisible();
    await expect(v.getByRole("link", { name: "Instagram" })).toHaveAttribute("href", "https://www.instagram.com/_uktambekovv/");
    await expect(v.getByText("hali kiritilmagan")).toHaveCount(0);
    await visitor.close();

    await page.goto("/super-admin/founder", { waitUntil: "networkidle" });
    await page.getByTestId("founder-name").fill("Asadbek Uktambekov");
    await expect(page.getByTestId("founder-name")).toHaveValue("Asadbek Uktambekov");
    await page.getByTestId("founder-save").click();
    await expect(page.getByText("Saqlandi")).toBeVisible();

    // Audit log shows admin actions (including the PRO grant from test 9).
    await page.goto("/super-admin/audit");
    await expect(page.getByText(`${PRO.email}: PRO`).first()).toBeVisible();

    // Every super admin (including the seeded one) has the full panel.
    const a = await admin.newPage();
    for (const path of ["/super-admin/requests", "/super-admin/team", "/super-admin/founder", "/super-admin/settings", "/super-admin/audit"]) {
      expect((await a.goto(path))?.status()).toBe(200);
    }

    // Promote the FREE user to super admin, check access, then demote again.
    await page.goto("/super-admin/team");
    await page.getByTestId("add-admin-input").fill(FREE.email);
    await page.getByTestId("add-admin-submit").click();
    await expect(page.getByText("Super admin qo‘shildi")).toBeVisible();
    const row = page.getByTestId("team-row").filter({ hasText: FREE.email });
    await expect(row).toBeVisible();
    const f = await free.newPage();
    expect((await f.goto("/super-admin"))?.status()).toBe(200);
    expect((await f.goto("/super-admin/team"))?.status()).toBe(200);
    await row.getByTestId("role-user").click();
    await page.getByTestId("role-user-confirm").click();
    await expect(page.getByTestId("team-row").filter({ hasText: FREE.email })).toHaveCount(0);
    expect((await f.goto("/super-admin"))?.status()).toBe(404);
  });

  test("16. Phone layout: bottom tab bar, menu sheet, no zoom-on-focus, no horizontal scroll", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Asosiy navigatsiya" })).toBeHidden();

    const tabs = page.getByTestId("bottom-nav");
    await expect(tabs).toBeVisible();
    for (const label of ["Bosh sahifa", "Darslar", "Kitoblar", "Challenge", "Kirish"]) {
      await expect(tabs.getByRole("link", { name: label })).toBeVisible();
    }
    await expect(tabs.getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute("aria-current", "page");
    await tabs.getByRole("link", { name: "Darslar" }).tap();
    await page.waitForURL("**/lessons");
    await expect(tabs.getByRole("link", { name: "Darslar" })).toHaveAttribute("aria-current", "page");

    await page.getByTestId("mobile-menu-trigger").tap();
    const nav = page.getByRole("navigation", { name: "Mobil navigatsiya" });
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "TradingView" }).tap();
    await page.waitForURL("**/tradingview");
    await expect(nav).toBeHidden();

    for (const path of ["/", "/subscription", "/founder", "/login"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
    // 16px+ inputs keep iOS Safari from zooming in on focus.
    const fontSize = await page.getByLabel("Email yoki login").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(16);

    // Thumb-sized purchase button on the pricing page.
    await page.goto("/subscription");
    const box = await page.getByTestId("buy-pro-guest").boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(48);
    await ctx.close();
  });

  test("17. TradingView page loads the widget or shows a helpful fallback", async () => {
    const page = await free.newPage();
    await page.goto("/tradingview");
    const panel = page.getByTestId("tradingview-panel");
    await expect(panel).toBeVisible();
    const iframe = panel.locator("iframe");
    const fallback = page.getByTestId("tradingview-fallback");
    await expect(iframe.or(fallback).first()).toBeVisible({ timeout: 25_000 });
    await page.getByRole("radio", { name: "GBP/USD" }).click();
    await expect(page.getByRole("radio", { name: "GBP/USD" })).toHaveAttribute("aria-checked", "true");
    await expect(iframe).toHaveAttribute("src", /symbol=FX%3AGBPUSD/);
    await expect(page.getByText("real vaqt rejimi kafolatlanmaydi")).toBeVisible();
  });

  test("18. Super admin confirms the Telegram payment → PRO opens for that user", async () => {
    const page = await founder.newPage();
    await page.goto("/super-admin");
    await expect(page.getByTestId("pending-requests-card")).toContainText(FREE.email);

    await page.goto("/super-admin/requests");
    const item = page.getByTestId("request-item").filter({ hasText: FREE.email });
    await expect(item).toBeVisible();
    expect(digits(await item.getByText(/so‘m/).first().textContent())).toBe("199000");
    await item.getByTestId("approve-request").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: "1 oy" }).click();
    await dialog.getByTestId("approve-request-confirm").click();
    await expect(page.getByText("To‘lov tasdiqlandi — PRO ochildi")).toBeVisible();
    await expect(page.getByTestId("request-item").filter({ hasText: FREE.email })).toHaveCount(0);
    await page.goto("/super-admin/requests?status=APPROVED");
    await expect(page.getByTestId("request-item").filter({ hasText: FREE.email })).toBeVisible();

    // The user gets PRO on their next page load — no re-login needed.
    const f = await free.newPage();
    await f.goto("/dashboard/subscription");
    await expect(f.getByTestId("subscription-badge")).toHaveText("PRO faol");
    await expect(f.getByTestId("pending-request-note")).toHaveCount(0);
    await f.goto("/books");
    await expect(f.getByTestId("pro-access-gate")).toHaveCount(0);
    await expect(f.getByTestId("book-card").first()).toBeVisible();

    // Audit trail records who opened PRO.
    await page.goto("/super-admin/audit");
    await expect(page.getByText(`${FREE.email}: PRO`).first()).toBeVisible();
  });
});
