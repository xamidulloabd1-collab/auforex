import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * Video lesson management: categories, lesson numbers, Free/PRO access, direct uploads (large
 * files in parts), invalid files, the founder portrait, books and the "check files" action,
 * and that nobody without access gets a video by calling the API directly.
 *
 * Works with local disk and with object storage. With E2E_S3=1 the server runs like on Vercel
 * (VERCEL=1, S3_* set): uploads go straight to the bucket and videos redirect to it.
 */
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@auforex.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe-Admin-2026!";
const S3 = process.env.E2E_S3 === "1";
const MEDIA = process.env.E2E_MEDIA_DIR ?? "/tmp/e2emedia";
const RUN = Date.now().toString(36);
const PASSWORD = "Trader2026x";
const CATEGORY = `Sinov toifa ${RUN}`;
const COURSE = `LMS kurs ${RUN}`;
const PRO_LESSON = `Support va Resistance ${RUN}`;
const FREE_LESSON = `Grafik bilan tanishish ${RUN}`;

let admin: BrowserContext;
let freeUser: BrowserContext;
let proUser: BrowserContext;
let proLessonUrl = "";
let freeLessonUrl = "";
let proLessonId = "";
let freeLessonId = "";

async function login(page: Page, id: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email yoki login").fill(id);
  await page.getByLabel("Parol", { exact: true }).fill(password);
  await page.getByTestId("login-form").getByRole("button", { name: "Kirish" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
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

async function lessonIdFromAdmin(page: Page, title: string) {
  await page.goto(`/super-admin/lessons?q=${encodeURIComponent(title)}`);
  const href = await page.getByTestId("admin-lesson-row").first().getByRole("link", { name: "Tahrirlash" }).getAttribute("href");
  return href!.split("/").pop()!;
}

test.describe.serial("Video LMS", () => {
  test.beforeAll(async ({ browser }) => {
    admin = await browser.newContext();
    freeUser = await browser.newContext();
    proUser = await browser.newContext();
    await login(await admin.newPage(), ADMIN_EMAIL, ADMIN_PASSWORD);
  });
  test.afterAll(async () => {
    await Promise.all([admin?.close(), freeUser?.close(), proUser?.close()]);
  });

  test("categories: create, rename, reorder, refuse deleting one in use, delete unused", async () => {
    const page = await admin.newPage();
    await page.goto("/super-admin/categories");
    await page.getByTestId("new-category-course").fill(`${CATEGORY} x`);
    await page.getByTestId("new-category-course").press("Enter");
    const row = page.getByTestId("category-row").filter({ hasText: `${CATEGORY} x` });
    await expect(row).toContainText("0 dars · 0 kurs");
    await row.getByRole("button", { name: "Tahrirlash" }).click();
    const editing = page.getByTestId("category-row").filter({ has: page.getByRole("textbox") });
    await editing.getByRole("textbox").fill(CATEGORY);
    await editing.getByRole("button", { name: "Saqlash" }).click();
    const renamed = page.getByTestId("category-row").filter({ hasText: CATEGORY });
    await expect(renamed).toBeVisible();
    // Reorder: move it up one place.
    const before = await page.getByTestId("category-row").allTextContents();
    await renamed.getByRole("button", { name: `${CATEGORY}: yuqoriga` }).click();
    await expect.poll(async () => (await page.getByTestId("category-row").allTextContents()).findIndex((t) => t.includes(CATEGORY))).toBe(
      before.findIndex((t) => t.includes(CATEGORY)) - 1,
    );
    // An unused throw-away category can be deleted.
    await page.getByTestId("new-category-course").fill(`O‘chiriladigan ${RUN}`);
    await page.getByTestId("new-category-course").press("Enter");
    const tmp = page.getByTestId("category-row").filter({ hasText: `O‘chiriladigan ${RUN}` });
    await tmp.getByRole("button").last().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "O‘chirish" }).click();
    await expect(tmp).toHaveCount(0);
  });

  test("lessons: number + category heading, large upload in parts, duplicate number refused, invalid file rejected", async () => {
    const page = await admin.newPage();
    await page.goto("/super-admin/courses");
    await page.getByTestId("new-course").click();
    await page.getByTestId("course-title").fill(COURSE);
    await page.getByRole("dialog").getByRole("switch").click();
    await page.getByRole("dialog").getByRole("button", { name: "Saqlash" }).click();
    await expect(page.getByRole("cell", { name: COURSE }).first()).toBeVisible();

    // PRO lesson no. 5 with a 13 MB video (direct upload in 10 MiB parts when S3 is on).
    await page.goto("/super-admin/lessons/new");
    await page.getByTestId("lesson-title").fill(PRO_LESSON);
    await page.getByTestId("lesson-course").selectOption({ label: COURSE });
    await page.getByTestId("lesson-category").selectOption({ label: CATEGORY });
    await page.getByTestId("lesson-number").fill("5");
    await page.getByTestId("lesson-level").selectOption("INTERMEDIATE");
    await expect(page.getByTestId("lesson-heading-preview")).toContainText(`${CATEGORY} — 5-dars`);
    const uploads: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "PUT") uploads.push(r.url());
    });
    await page.getByTestId("video-upload").setInputFiles(`${MEDIA}/big.mp4`);
    await expect(page.getByText("Video yuklangan")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId("lesson-duration")).toHaveValue("20");
    if (S3) {
      const parts = uploads.filter((u) => u.includes("partNumber="));
      expect(parts.length).toBe(2);
      expect(uploads.every((u) => !u.includes("/api/admin/upload"))).toBe(true);
    }
    await page.getByTestId("lesson-publish").click();
    await page.getByTestId("lesson-save").click();
    await page.waitForURL("**/super-admin/lessons");

    // Same number in the same course is refused with a clear message.
    await page.goto("/super-admin/lessons/new");
    await page.getByTestId("lesson-title").fill(`Takror ${RUN}`);
    await page.getByTestId("lesson-course").selectOption({ label: COURSE });
    await page.getByTestId("lesson-category").selectOption({ label: CATEGORY });
    await page.getByTestId("lesson-number").fill("5");
    await page.getByTestId("lesson-save").click();
    await expect(page.getByText("5-dars allaqachon bor")).toBeVisible();

    // A text file named .mp4 is rejected by its content.
    await page.getByTestId("video-upload").setInputFiles(`${MEDIA}/fake.mp4`);
    await expect(page.getByText(/mos emas|qo‘llab-quvvatlanmaydi/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Video yuklangan")).toHaveCount(0);

    // Free lesson no. 1 (small file → single upload).
    await page.getByTestId("lesson-title").fill(FREE_LESSON);
    await page.getByTestId("lesson-number").fill("1");
    await page.getByTestId("lesson-access").selectOption("FREE");
    await page.getByTestId("video-upload").setInputFiles(`${MEDIA}/small.mp4`);
    await expect(page.getByText("Video yuklangan")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("lesson-publish").click();
    await page.getByTestId("lesson-save").click();
    await page.waitForURL("**/super-admin/lessons");

    // Admin table: search + category filter, numbers and access shown.
    await page.goto(`/super-admin/lessons?category=&q=${encodeURIComponent(RUN)}`);
    const rows = page.getByTestId("admin-lesson-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: PRO_LESSON })).toContainText("5-dars");
    await expect(rows.filter({ hasText: PRO_LESSON })).toContainText("PRO");
    await expect(rows.filter({ hasText: FREE_LESSON })).toContainText("Bepul");
    proLessonId = await lessonIdFromAdmin(page, PRO_LESSON);
    freeLessonId = await lessonIdFromAdmin(page, FREE_LESSON);

    // Category now in use → cannot be deleted.
    await page.goto("/super-admin/categories");
    const used = page.getByTestId("category-row").filter({ hasText: CATEGORY });
    await expect(used).toContainText("2 dars");
    await used.getByRole("button").last().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "O‘chirish" }).click();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "ishlatilmoqda" })).toBeVisible();
    await expect(used).toBeVisible();
  });

  test("uploads: cancel stops and cleans up; a dropped part is retried", async () => {
    const page = await admin.newPage();
    await page.goto("/super-admin/lessons/new");

    // 1) Cancelled while the upload is still being prepared: no file data may be sent afterwards.
    const prepare = /\/api\/admin\/uploads$/;
    await page.route(prepare, async (route) => {
      if ((route.request().postData() ?? "").includes('"action":"init"')) await new Promise((r) => setTimeout(r, 3000));
      await route.continue().catch(() => {});
    });
    const sentData: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "PUT") sentData.push(r.url());
    });
    await page.getByTestId("video-upload").setInputFiles(`${MEDIA}/small.mp4`);
    await page.getByTestId("video-upload-cancel").click();
    await expect(page.getByText("Yuklash bekor qilindi")).toBeVisible();
    await page.waitForTimeout(3500);
    expect(sentData, "no PUT after cancelling during preparation").toEqual([]);
    await expect(page.getByText("Video yuklangan")).toHaveCount(0);
    await page.unroute(prepare);
    await expect(page.getByText("Yuklash bekor qilindi")).toHaveCount(0, { timeout: 15_000 });

    // 2) Cancelled while the data is being sent. Slow the transport down so there is time to press "Bekor qilish".
    const transport = S3 ? /127\.0\.0\.1:5055\// : /\/api\/admin\/upload\?/;
    await page.route(transport, async (route) => {
      if (route.request().method() === "PUT") await new Promise((r) => setTimeout(r, 4000));
      await route.continue().catch(() => {});
    });
    const abortCall = S3
      ? page.waitForRequest((r) => r.url().endsWith("/api/admin/uploads") && (r.postData() ?? "").includes('"action":"abort"'))
      : null;
    await page.getByTestId("video-upload").setInputFiles(`${MEDIA}/big.mp4`);
    await expect(page.getByTestId("video-upload-progress")).toBeVisible();
    await page.getByTestId("video-upload-cancel").click();
    await expect(page.getByText("Yuklash bekor qilindi")).toBeVisible();
    await expect(page.getByTestId("video-upload-progress")).toHaveCount(0);
    await expect(page.getByText("Video yuklangan")).toHaveCount(0);
    // With object storage the unfinished multipart upload is aborted in the bucket as well.
    if (abortCall) expect((await (await abortCall).response())?.status()).toBe(200);
    await page.unroute(transport);

    if (S3) {
      // The first attempt of the first part fails on the network; the upload still completes.
      let dropped = 0;
      await page.route(transport, async (route) => {
        if (route.request().method() === "PUT" && dropped === 0) {
          dropped++;
          return route.abort("failed");
        }
        return route.continue();
      });
      await page.getByTestId("video-upload").setInputFiles(`${MEDIA}/big.mp4`);
      await expect(page.getByText("Video yuklangan")).toBeVisible({ timeout: 90_000 });
      expect(dropped).toBe(1);
    }
    await page.close();
  });

  test("FREE user: free lesson plays, PRO lesson locked; the video API refuses direct calls", async () => {
    const page = await freeUser.newPage();
    await register(page, "Free LMS", `free-lms-${RUN}@example.com`);
    await page.goto("/lessons");
    const proCard = page.getByTestId("lesson-card").filter({ hasText: PRO_LESSON });
    await expect(proCard).toHaveAttribute("data-lock-reason", "pro");
    await expect(proCard.getByTestId("lesson-number")).toContainText("5-dars");
    const freeCard = page.getByTestId("lesson-card").filter({ hasText: FREE_LESSON });
    await expect(freeCard).not.toHaveAttribute("data-locked", "true");

    await freeCard.click();
    await page.waitForURL("**/lessons/**");
    freeLessonUrl = page.url();
    await expect(page.getByTestId("lesson-heading")).toHaveText(`${CATEGORY} — 1-dars`, { ignoreCase: true });
    await expect(page.locator("video")).toHaveCount(1);
    await expect.poll(() => page.locator("video").evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 20_000 }).toBeGreaterThan(0);

    await page.goto("/lessons");
    await proCard.click();
    await expect(page.getByTestId("lesson-pro-locked")).toBeVisible();
    await expect(page.locator("video, iframe")).toHaveCount(0);
    proLessonUrl = page.url();

    const video = await page.request.get(`/api/lessons/${proLessonId}/video`, { maxRedirects: 0 });
    expect(video.status()).toBe(403);
    const progress = await page.request.post(`/api/lessons/${proLessonId}/progress`, {
      data: { positionSeconds: 10, completed: true },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(progress.status()).toBe(403);
    const freeProgress = await page.request.post(`/api/lessons/${freeLessonId}/progress`, {
      data: { positionSeconds: 2, durationSeconds: 4 },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(freeProgress.status()).toBe(200);
  });

  test("guest: catalogue visible with the subscription offer, media API answers 401", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/lessons");
    await expect(page.getByTestId("pro-access-gate")).toBeVisible();
    await expect(page.getByTestId("lesson-card").filter({ hasText: PRO_LESSON })).toHaveAttribute("data-lock-reason", "pro");
    expect((await page.request.get(`/api/lessons/${freeLessonId}/video`, { maxRedirects: 0 })).status()).toBe(401);
    await page.goto(proLessonUrl);
    await page.waitForURL("**/login**");
    await ctx.close();
  });

  test("PRO user: numbered heading, video plays (from the bucket when S3 is on), progress saved", async () => {
    const page = await proUser.newPage();
    const email = `pro-lms-${RUN}@example.com`;
    await register(page, "Pro LMS", email);
    const a = await admin.newPage();
    await a.goto(`/super-admin/users?q=${encodeURIComponent(email)}`);
    await a.getByTestId("admin-user-row").first().click();
    await a.getByTestId("grant-pro").click();
    await expect(a.getByTestId("admin-sub-status")).toHaveText("PRO faol");

    // Lessons open in order (default setting): no. 5 waits until no. 1 is completed.
    await page.goto(proLessonUrl);
    await expect(page.getByTestId("lesson-locked")).toBeVisible();
    expect((await page.request.get(`/api/lessons/${proLessonId}/video`, { maxRedirects: 0 })).status()).toBe(403);
    await page.getByTestId("go-to-blocker").click();
    await page.waitForURL(freeLessonUrl);
    await page.getByTestId("mark-complete").click();
    await expect(page.getByTestId("next-lesson")).toContainText(PRO_LESSON);
    await page.goto(proLessonUrl);
    await expect(page.getByTestId("lesson-heading")).toHaveText(`${CATEGORY} — 5-dars`, { ignoreCase: true });
    await expect.poll(() => page.locator("video").evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 30_000 }).toBeGreaterThan(0);
    const res = await page.request.get(`/api/lessons/${proLessonId}/video`, { maxRedirects: 0 });
    if (S3) {
      expect(res.status()).toBe(302);
      const location = res.headers().location!;
      expect(location).toContain("X-Amz-Signature=");
      expect(location).toContain("X-Amz-Expires=10800");
      const media = await page.request.get(location, { headers: { range: "bytes=0-15" } });
      expect(media.status()).toBe(206);
      expect(media.headers()["content-type"]).toBe("video/mp4");
    } else {
      expect([200, 206]).toContain(res.status());
    }
    const saved = await page.request.post(`/api/lessons/${proLessonId}/progress`, {
      data: { positionSeconds: 19, durationSeconds: 20 },
      headers: { origin: new URL(page.url()).origin },
    });
    expect((await saved.json()).completed).toBe(true);
  });

  test("founder portrait: upload, save, shown on the public Founder page", async () => {
    const page = await admin.newPage();
    await page.goto("/super-admin/founder");
    await page.getByTestId("founder-upload").setInputFiles(`${MEDIA}/founder.png`);
    await expect(page.getByText("Portret yuklangan")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("founder-save").click();
    await expect(page.getByText(/saqlandi/i).first()).toBeVisible();
    await page.goto("/founder");
    const img = page.locator('img[src*="founder"]').first();
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
  });

  test("books: PDF upload persists and opens; check-files relinks a seeded book whose file is gone", async () => {
    const page = await admin.newPage();
    await page.goto("/super-admin/books/new");
    await page.getByTestId("book-upload").setInputFiles(`${MEDIA}/book.pdf`);
    await expect(page.getByText(/PDF yuklangan ·/)).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("book-title").fill(`Sinov kitobi ${RUN}`);
    await page.getByTestId("book-form").getByRole("switch").first().click();
    await page.getByTestId("book-form").getByRole("button", { name: "Saqlash" }).click();
    await page.waitForURL("**/super-admin/books");

    await page.goto("/super-admin/books");
    await page.getByTestId("check-book-files").click();
    await expect(page.getByTestId("book-file-report")).toBeVisible();
    await expect(page.getByTestId("book-file-report")).toContainText(/joyida|qayta ulandi/);

    const reader = await proUser.newPage();
    await reader.goto("/books");
    await reader.getByTestId("book-card").filter({ hasText: `Sinov kitobi ${RUN}` }).getByRole("link", { name: /O‘qish|Davom ettirish/ }).click();
    const pdf = reader.getByTestId("pdf-reader");
    await expect(pdf.getByText("/ 2").filter({ visible: true })).toBeVisible({ timeout: 30_000 });
    await expect(pdf.locator("canvas")).toBeVisible();
    // The seeded "Trading Noldan" (served from the deployment bundle) opens as well.
    await reader.goto("/books");
    await reader.getByTestId("book-card").filter({ hasText: "Trading Noldan" }).getByRole("link", { name: /O‘qish|Davom ettirish/ }).click();
    await expect(reader.getByTestId("pdf-reader").getByText("/ 178").filter({ visible: true })).toBeVisible({ timeout: 30_000 });
  });
});
