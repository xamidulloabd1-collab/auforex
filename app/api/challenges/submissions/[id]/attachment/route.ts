import { getViewer } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { fileResponse, PRIVATE_NO_STORE } from "@/lib/storage/serve";

/** Submission attachments: visible only to the author and administrators. */
export async function GET(request: Request, ctx: RouteContext<"/api/challenges/submissions/[id]/attachment">) {
  const { id } = await ctx.params;
  const viewer = await getViewer();
  if (!viewer) return new Response("Unauthorized", { status: 401 });
  const sub = await prisma.challengeSubmission.findUnique({ where: { id }, select: { userId: true, attachmentKey: true, attachmentMime: true } });
  if (!sub?.attachmentKey || (sub.userId !== viewer.id && !viewer.isAdmin)) return new Response("Not found", { status: 404 });
  return fileResponse(request, { key: sub.attachmentKey, mime: sub.attachmentMime ?? "image/png", cacheControl: PRIVATE_NO_STORE, disposition: "inline" });
}
