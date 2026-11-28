import { getViewer } from "@/lib/auth/session";
import { relinkMissingSeededBookAsset } from "@/lib/books/file-check";
import { prisma } from "@/lib/db/prisma";
import { fileResponse, PRIVATE_NO_STORE } from "@/lib/storage/serve";

/**
 * Serves a book PDF to the in-app reader. Access: PRO (or admin) + book published.
 * Note: no web technology can fully prevent saving or screenshotting content that a
 * browser is allowed to display; this route only ensures unauthorised users get nothing.
 */
async function handle(request: Request, ctx: RouteContext<"/api/books/[id]/file">) {
  const { id } = await ctx.params;
  const viewer = await getViewer();
  if (!viewer) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!viewer.hasPremium) return new Response("PRO subscription required", { status: 403, headers: { "Cache-Control": "no-store" } });

  const book = await prisma.book.findUnique({
    where: { id },
    select: { id: true, fileKey: true, fileSize: true, coverKey: true, isPublished: true },
  });
  if (!book || (!book.isPublished && !viewer.isAdmin)) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const fileKey = await relinkMissingSeededBookAsset(book, "file");
  return fileResponse(request, {
    key: fileKey,
    mime: "application/pdf",
    cacheControl: PRIVATE_NO_STORE,
    disposition: "inline",
  });
}

export { handle as GET, handle as HEAD };
