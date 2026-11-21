import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, handleRouteError, jsonError } from "@/lib/api";
import { assertUser } from "@/lib/auth/session";
import { checkLessonAchievements } from "@/lib/achievements";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  positionSeconds: z.number().min(0).max(60 * 60 * 24),
  durationSeconds: z.number().min(0).max(60 * 60 * 24).nullable().optional(),
  completed: z.boolean().optional(),
});

export async function POST(request: Request, ctx: RouteContext<"/api/lessons/[id]/progress">) {
  try {
    assertSameOrigin(request);
    const viewer = await assertUser();
    if (!viewer.hasPremium) return jsonError(403, "PRO obuna talab qilinadi");
    rateLimit(`lesson-progress:${viewer.id}`, 90, 60_000);

    const { id } = await ctx.params;
    const body = bodySchema.parse(await request.json());

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      select: { id: true, isPublished: true, durationSeconds: true, course: { select: { isPublished: true } } },
    });
    if (!lesson || (!(lesson.isPublished && lesson.course.isPublished) && !viewer.isAdmin)) {
      return jsonError(404, "Dars topilmadi");
    }

    const duration = body.durationSeconds || lesson.durationSeconds || null;
    const position = Math.floor(body.positionSeconds);
    const percent = duration ? Math.min(100, Math.round((position / duration) * 100)) : 0;
    const completedNow = body.completed === true || percent >= 90;

    const existing = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: viewer.id, lessonId: lesson.id } },
      select: { completedAt: true, percent: true },
    });
    const completedAt = existing?.completedAt ?? (completedNow ? new Date() : null);

    const saved = await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: viewer.id, lessonId: lesson.id } },
      update: {
        positionSeconds: position,
        durationSeconds: duration ? Math.round(duration) : undefined,
        percent: completedAt ? 100 : Math.max(percent, existing?.percent ?? 0),
        completedAt,
        lastViewedAt: new Date(),
      },
      create: {
        userId: viewer.id,
        lessonId: lesson.id,
        positionSeconds: position,
        durationSeconds: duration ? Math.round(duration) : null,
        percent: completedAt ? 100 : percent,
        completedAt,
      },
      select: { percent: true, completedAt: true },
    });

    if (completedAt && !existing?.completedAt) await checkLessonAchievements(viewer.id);

    return NextResponse.json({ percent: saved.percent, completed: Boolean(saved.completedAt) });
  } catch (err) {
    return handleRouteError(err);
  }
}
