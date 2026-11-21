import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, handleRouteError, jsonError } from "@/lib/api";
import { assertUser } from "@/lib/auth/session";
import { awardAchievement } from "@/lib/achievements";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  page: z.number().int().min(1).max(100_000),
  totalPages: z.number().int().min(1).max(100_000),
});

export async function POST(request: Request, ctx: RouteContext<"/api/books/[id]/progress">) {
  try {
    assertSameOrigin(request);
    const viewer = await assertUser();
    if (!viewer.hasPremium) return jsonError(403, "PRO obuna talab qilinadi");
    rateLimit(`book-progress:${viewer.id}`, 120, 60_000);

    const { id } = await ctx.params;
    const { page, totalPages } = bodySchema.parse(await request.json());
    const book = await prisma.book.findUnique({ where: { id }, select: { id: true, isPublished: true } });
    if (!book || (!book.isPublished && !viewer.isAdmin)) return jsonError(404, "Kitob topilmadi");

    const current = Math.min(page, totalPages);
    const percent = Math.round((current / totalPages) * 100);
    const existing = await prisma.readingProgress.findUnique({
      where: { userId_bookId: { userId: viewer.id, bookId: book.id } },
      select: { completedAt: true },
    });
    const completedAt = existing?.completedAt ?? (current >= totalPages ? new Date() : null);

    await prisma.readingProgress.upsert({
      where: { userId_bookId: { userId: viewer.id, bookId: book.id } },
      update: { currentPage: current, totalPages, percent: completedAt ? 100 : percent, completedAt, lastOpenedAt: new Date() },
      create: { userId: viewer.id, bookId: book.id, currentPage: current, totalPages, percent, completedAt },
    });
    if (completedAt && !existing?.completedAt) await awardAchievement(viewer.id, "FIRST_BOOK");

    return NextResponse.json({ percent: completedAt ? 100 : percent, page: current });
  } catch (err) {
    return handleRouteError(err);
  }
}
