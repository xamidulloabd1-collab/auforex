import { getViewer } from "@/lib/auth/session";
import { getLessonBlocker } from "@/lib/data/learning";
import { prisma } from "@/lib/db/prisma";
import { getStorage } from "@/lib/storage";
import { isBundledKey } from "@/lib/storage/keys";
import { fileResponse, PRIVATE_NO_STORE } from "@/lib/storage/serve";

const VIDEO_LINK_SECONDS = 3 * 60 * 60;

/**
 * Streams an uploaded lesson video with Range support.
 * Access: free lesson → any signed-in user; otherwise PRO (or admin). Lesson and course
 * published (admins may preview drafts),
 * and — in sequential mode — every earlier lesson of the course completed.
 */
async function handle(request: Request, ctx: RouteContext<"/api/lessons/[id]/video">) {
  const { id } = await ctx.params;
  const viewer = await getViewer();
  if (!viewer) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });

  const lesson = await prisma.lesson.findUnique({
    where: { id },
    select: { videoKey: true, videoMime: true, videoSource: true, isPublished: true, isFree: true, course: { select: { isPublished: true } } },
  });
  // Free lessons: any signed-in user. Everything else: PRO or admin — checked here, server-side,
  // so calling this URL directly never bypasses the subscription.
  if (lesson && !lesson.isFree && !viewer.hasPremium) {
    return new Response("PRO subscription required", { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const visible = lesson && lesson.isPublished && lesson.course.isPublished;
  if (!lesson || (!visible && !viewer.isAdmin) || lesson.videoSource !== "UPLOAD" || !lesson.videoKey) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  if (await getLessonBlocker(id, viewer)) {
    return new Response("Finish the previous lesson first", { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  // Object storage: after the checks above, the browser plays the file straight from the bucket
  // through a link that expires (3 h) — video never streams through a Vercel function.
  const storage = getStorage();
  if (storage.signedReadUrl && !isBundledKey(lesson.videoKey)) {
    if (!(await storage.stat(lesson.videoKey))) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    return new Response(null, {
      status: 302,
      headers: { Location: storage.signedReadUrl(lesson.videoKey, VIDEO_LINK_SECONDS), "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
    });
  }

  return fileResponse(request, {
    key: lesson.videoKey,
    mime: lesson.videoMime ?? "video/mp4",
    cacheControl: PRIVATE_NO_STORE,
    disposition: "inline",
  });
}

export { handle as GET, handle as HEAD };
