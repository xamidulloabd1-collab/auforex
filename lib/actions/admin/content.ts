"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db/prisma";
import { normalizeEmbedUrl } from "@/lib/embed";
import { deleteStoredFile } from "@/lib/storage";
import { slugify } from "@/lib/utils";
import { bookSchema, categorySchema, courseSchema, lessonSchema } from "@/lib/validations/admin";
import { actionError, UserFacingError, type ActionResult } from "../result";
import { assertStoredKey, nullable, uniqueSlug } from "./helpers";

const idSchema = z.string().min(1).max(40);

function revalidateLearning() {
  revalidatePath("/", "layout");
}

// ── Categories ─────────────────────────────────────────────

export async function saveCategory(id: string | null, input: z.input<typeof categorySchema>): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const data = categorySchema.parse(input);
    const slug = slugify(data.name);
    if (!slug) throw new UserFacingError("Nom noto‘g‘ri");
    const saved = id
      ? await prisma.category.update({ where: { id: idSchema.parse(id) }, data: { name: data.name, slug, order: data.order } })
      : await prisma.category.create({ data: { name: data.name, slug, kind: data.kind, order: data.order } });
    await audit({ actorId: admin.id, action: id ? "category.update" : "category.create", targetType: "Category", targetId: saved.id, summary: `${data.kind}: ${data.name}` });
    revalidateLearning();
    return { ok: true, message: "Kategoriya saqlandi" };
  } catch (err) {
    return actionError(err);
  }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const cat = await prisma.category.delete({ where: { id: idSchema.parse(id) } });
    await audit({ actorId: admin.id, action: "category.delete", targetType: "Category", targetId: id, summary: cat.name });
    revalidateLearning();
    return { ok: true, message: "Kategoriya o‘chirildi (bog‘langan kontent kategoriyasiz qoldi)" };
  } catch (err) {
    return actionError(err);
  }
}

// ── Courses ────────────────────────────────────────────────

export async function saveCourse(id: string | null, input: z.input<typeof courseSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await assertAdmin();
    const data = courseSchema.parse(input);
    const slug = await uniqueSlug("course", data.slug, data.title, id ?? undefined);
    const payload = {
      title: data.title,
      slug,
      description: nullable(data.description),
      categoryId: nullable(data.categoryId),
      order: data.order,
      isPublished: data.isPublished,
    };
    const saved = id
      ? await prisma.course.update({ where: { id: idSchema.parse(id) }, data: payload })
      : await prisma.course.create({ data: payload });
    await audit({ actorId: admin.id, action: id ? "course.update" : "course.create", targetType: "Course", targetId: saved.id, summary: data.title });
    revalidateLearning();
    return { ok: true, data: { id: saved.id }, message: "Kurs saqlandi" };
  } catch (err) {
    return actionError(err);
  }
}

export async function deleteCourse(id: string): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const count = await prisma.lesson.count({ where: { courseId: idSchema.parse(id) } });
    if (count > 0) throw new UserFacingError(`Kursda ${count} ta dars bor. Avval darslarni o‘chiring yoki boshqa kursga ko‘chiring.`);
    const course = await prisma.course.delete({ where: { id } });
    await audit({ actorId: admin.id, action: "course.delete", targetType: "Course", targetId: id, summary: course.title });
    revalidateLearning();
    return { ok: true, message: "Kurs o‘chirildi" };
  } catch (err) {
    return actionError(err);
  }
}

// ── Lessons ────────────────────────────────────────────────

export async function saveLesson(id: string | null, input: z.input<typeof lessonSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await assertAdmin();
    const data = lessonSchema.parse(input);
    const course = await prisma.course.findUnique({ where: { id: data.courseId }, select: { id: true } });
    if (!course) throw new UserFacingError("Kurs topilmadi");

    let embedUrl: string | null = null;
    let videoInfo: { size: number } | null = null;
    if (data.videoSource === "EMBED") {
      embedUrl = normalizeEmbedUrl(data.embedUrl);
      if (!embedUrl) throw new UserFacingError("Faqat YouTube, Vimeo yoki Bunny Stream havolalari qabul qilinadi");
    } else {
      videoInfo = await assertStoredKey(data.videoKey, "videos");
    }
    await assertStoredKey(data.thumbnailKey, "thumbnails");

    const existing = id
      ? await prisma.lesson.findUnique({ where: { id: idSchema.parse(id) }, select: { videoKey: true, thumbnailKey: true, publishedAt: true } })
      : null;
    if (id && !existing) throw new UserFacingError("Dars topilmadi");

    const slug = await uniqueSlug("lesson", data.slug, data.title, id ?? undefined);
    const videoKey = data.videoSource === "UPLOAD" ? data.videoKey : null;
    const payload = {
      title: data.title,
      slug,
      description: nullable(data.description),
      courseId: data.courseId,
      order: data.order,
      durationSeconds: data.durationSeconds || null,
      videoSource: data.videoSource,
      videoKey,
      videoMime: videoKey ? (videoKey.endsWith(".webm") ? "video/webm" : "video/mp4") : null,
      videoSize: videoInfo ? BigInt(videoInfo.size) : null,
      embedUrl,
      thumbnailKey: data.thumbnailKey,
      isPublished: data.isPublished,
      publishedAt: data.isPublished ? (existing?.publishedAt ?? new Date()) : null,
    };
    const saved = id ? await prisma.lesson.update({ where: { id }, data: payload }) : await prisma.lesson.create({ data: payload });

    // Clean up replaced files.
    if (existing?.videoKey && existing.videoKey !== videoKey) await deleteStoredFile(existing.videoKey);
    if (existing?.thumbnailKey && existing.thumbnailKey !== data.thumbnailKey) await deleteStoredFile(existing.thumbnailKey);

    await audit({ actorId: admin.id, action: id ? "lesson.update" : "lesson.create", targetType: "Lesson", targetId: saved.id, summary: data.title });
    revalidateLearning();
    return { ok: true, data: { id: saved.id }, message: "Dars saqlandi" };
  } catch (err) {
    return actionError(err);
  }
}

export async function setLessonPublished(id: string, isPublished: boolean): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const lesson = await prisma.lesson.findUnique({ where: { id: idSchema.parse(id) }, select: { videoKey: true, embedUrl: true, title: true, publishedAt: true } });
    if (!lesson) throw new UserFacingError("Dars topilmadi");
    if (isPublished && !lesson.videoKey && !lesson.embedUrl) throw new UserFacingError("Videosiz darsni nashr qilib bo‘lmaydi");
    await prisma.lesson.update({ where: { id }, data: { isPublished, publishedAt: isPublished ? (lesson.publishedAt ?? new Date()) : null } });
    await audit({ actorId: admin.id, action: "lesson.publish", targetType: "Lesson", targetId: id, summary: `${lesson.title}: ${isPublished ? "nashr" : "yashirildi"}` });
    revalidateLearning();
    return { ok: true, message: isPublished ? "Nashr qilindi" : "Nashrdan olindi" };
  } catch (err) {
    return actionError(err);
  }
}

export async function moveLesson(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    await assertAdmin();
    const lesson = await prisma.lesson.findUnique({ where: { id: idSchema.parse(id) }, select: { id: true, courseId: true } });
    if (!lesson) throw new UserFacingError("Dars topilmadi");
    const siblings = await prisma.lesson.findMany({ where: { courseId: lesson.courseId }, orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true } });
    const idx = siblings.findIndex((s) => s.id === id);
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= siblings.length) return { ok: true };
    const reordered = [...siblings];
    [reordered[idx], reordered[swap]] = [reordered[swap]!, reordered[idx]!];
    await prisma.$transaction(reordered.map((s, i) => prisma.lesson.update({ where: { id: s.id }, data: { order: i + 1 } })));
    revalidateLearning();
    return { ok: true };
  } catch (err) {
    return actionError(err);
  }
}

export async function deleteLesson(id: string): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const lesson = await prisma.lesson.delete({ where: { id: idSchema.parse(id) } });
    await deleteStoredFile(lesson.videoKey);
    await deleteStoredFile(lesson.thumbnailKey);
    await audit({ actorId: admin.id, action: "lesson.delete", targetType: "Lesson", targetId: id, summary: lesson.title });
    revalidateLearning();
    return { ok: true, message: "Dars o‘chirildi" };
  } catch (err) {
    return actionError(err);
  }
}

// ── Books ──────────────────────────────────────────────────

export async function saveBook(id: string | null, input: z.input<typeof bookSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await assertAdmin();
    const data = bookSchema.parse(input);
    const fileInfo = await assertStoredKey(data.fileKey, "books");
    await assertStoredKey(data.coverKey, "covers");
    const existing = id ? await prisma.book.findUnique({ where: { id: idSchema.parse(id) }, select: { fileKey: true, coverKey: true, publishedAt: true } }) : null;
    if (id && !existing) throw new UserFacingError("Kitob topilmadi");

    const slug = await uniqueSlug("book", data.slug, data.title, id ?? undefined);
    const payload = {
      title: data.title,
      slug,
      author: nullable(data.author),
      description: nullable(data.description),
      pageCount: data.pageCount,
      categoryId: nullable(data.categoryId),
      fileKey: data.fileKey,
      fileSize: fileInfo?.size ?? data.fileSize,
      coverKey: data.coverKey,
      order: data.order,
      isPublished: data.isPublished,
      publishedAt: data.isPublished ? (existing?.publishedAt ?? new Date()) : null,
    };
    const saved = id ? await prisma.book.update({ where: { id }, data: payload }) : await prisma.book.create({ data: payload });
    if (existing?.fileKey && existing.fileKey !== data.fileKey) await deleteStoredFile(existing.fileKey);
    if (existing?.coverKey && existing.coverKey !== data.coverKey) await deleteStoredFile(existing.coverKey);
    await audit({ actorId: admin.id, action: id ? "book.update" : "book.create", targetType: "Book", targetId: saved.id, summary: data.title });
    revalidateLearning();
    return { ok: true, data: { id: saved.id }, message: "Kitob saqlandi" };
  } catch (err) {
    return actionError(err);
  }
}

export async function setBookPublished(id: string, isPublished: boolean): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const book = await prisma.book.findUnique({ where: { id: idSchema.parse(id) }, select: { title: true, publishedAt: true } });
    if (!book) throw new UserFacingError("Kitob topilmadi");
    await prisma.book.update({ where: { id }, data: { isPublished, publishedAt: isPublished ? (book.publishedAt ?? new Date()) : null } });
    await audit({ actorId: admin.id, action: "book.publish", targetType: "Book", targetId: id, summary: `${book.title}: ${isPublished ? "nashr" : "yashirildi"}` });
    revalidateLearning();
    return { ok: true, message: isPublished ? "Nashr qilindi" : "Nashrdan olindi" };
  } catch (err) {
    return actionError(err);
  }
}

export async function deleteBook(id: string): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const book = await prisma.book.delete({ where: { id: idSchema.parse(id) } });
    await deleteStoredFile(book.fileKey);
    await deleteStoredFile(book.coverKey);
    await audit({ actorId: admin.id, action: "book.delete", targetType: "Book", targetId: id, summary: book.title });
    revalidateLearning();
    return { ok: true, message: "Kitob o‘chirildi" };
  } catch (err) {
    return actionError(err);
  }
}
