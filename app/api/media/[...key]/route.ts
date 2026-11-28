import { fileResponse, PUBLIC_IMMUTABLE } from "@/lib/storage/serve";
import { isPublicKey, isValidStorageKey } from "@/lib/storage/keys";
import { relinkMissingSeededBookAsset } from "@/lib/books/file-check";
import { prisma } from "@/lib/db/prisma";

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

/**
 * Public imagery only (covers, thumbnails, avatars, founder portrait).
 * Videos, books and submission attachments are NEVER served from here.
 */
async function handle(request: Request, ctx: RouteContext<"/api/media/[...key]">) {
  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  if (!isValidStorageKey(key) || !isPublicKey(key)) {
    return new Response("Not found", { status: 404 });
  }
  const ext = key.split(".").pop() ?? "";
  const mime = MIME[ext];
  if (!mime) return new Response("Not found", { status: 404 });
  const response = await fileResponse(request, { key, mime, cacheControl: PUBLIC_IMMUTABLE });
  if (response.status !== 404 || !/^(?:bundled\/)?covers\//.test(key)) return response;

  const book = await prisma.book.findFirst({
    where: { coverKey: key },
    select: { id: true, fileKey: true, fileSize: true, coverKey: true },
  });
  if (!book) return response;

  const coverKey = await relinkMissingSeededBookAsset(book, "cover");
  if (!coverKey || coverKey === key) return response;
  const replacementMime = MIME[coverKey.split(".").pop() ?? ""];
  if (!replacementMime) return response;
  return fileResponse(request, { key: coverKey, mime: replacementMime, cacheControl: PUBLIC_IMMUTABLE });
}

export { handle as GET, handle as HEAD };
