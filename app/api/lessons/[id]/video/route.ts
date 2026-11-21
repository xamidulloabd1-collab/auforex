import { getViewer } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { fileResponse, PRIVATE_NO_STORE } from "@/lib/storage/serve";

/**
 * Streams an uploaded lesson video with Range support.
 * Access: PRO (or admin) + lesson and course published (admins may preview drafts).
 */
async function handle(request: Request, ctx: RouteContext<"/api/lessons/[id]/video">) {
  const { id } = await ctx.params;
  const viewer = await getViewer();
  if (!viewer) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!viewer.hasPremium) return new Response("PRO subscription required", { status: 403, headers: { "Cache-Control": "no-store" } });

  const lesson = await prisma.lesson.findUnique({
    where: { id },
    select: { videoKey: true, videoMime: true, videoSource: true, isPublished: true, course: { select: { isPublished: true } } },
  });
  const visible = lesson && lesson.isPublished && lesson.course.isPublished;
  if (!lesson || (!visible && !viewer.isAdmin) || lesson.videoSource !== "UPLOAD" || !lesson.videoKey) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  return fileResponse(request, {
    key: lesson.videoKey,
    mime: lesson.videoMime ?? "video/mp4",
    cacheControl: PRIVATE_NO_STORE,
    disposition: "inline",
  });
}

export { handle as GET, handle as HEAD };
