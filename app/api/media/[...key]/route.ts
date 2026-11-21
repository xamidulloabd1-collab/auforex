import { fileResponse, PUBLIC_IMMUTABLE } from "@/lib/storage/serve";
import { isPublicKey, isValidStorageKey } from "@/lib/storage/keys";

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
  return fileResponse(request, { key, mime, cacheControl: PUBLIC_IMMUTABLE });
}

export { handle as GET, handle as HEAD };
