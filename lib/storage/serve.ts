import "server-only";
import { getStorage } from "./index";

/**
 * Builds a streaming file response with HTTP Range support (needed for video seeking
 * and progressive PDF loading).
 */
export async function fileResponse(
  request: Request,
  opts: {
    key: string;
    mime: string;
    cacheControl: string;
    disposition?: "inline" | "attachment";
    filename?: string;
  },
): Promise<Response> {
  const storage = getStorage();
  const info = await storage.stat(opts.key);
  if (!info) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "Content-Type": opts.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": opts.cacheControl,
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
  });
  if (opts.disposition) {
    const name = opts.filename ? `; filename="${opts.filename.replace(/[^\w.\- ]/g, "_")}"` : "";
    headers.set("Content-Disposition", `${opts.disposition}${name}`);
  }

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (!match || (match[1] === "" && match[2] === "")) {
      headers.set("Content-Range", `bytes */${info.size}`);
      return new Response(null, { status: 416, headers });
    }
    let start: number;
    let end: number;
    if (match[1] === "") {
      // suffix range: last N bytes
      const suffix = Number(match[2]);
      start = Math.max(0, info.size - suffix);
      end = info.size - 1;
    } else {
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
    }
    if (start >= info.size || start > end) {
      headers.set("Content-Range", `bytes */${info.size}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
    headers.set("Content-Length", String(end - start + 1));
    if (request.method === "HEAD") return new Response(null, { status: 206, headers });
    return new Response(storage.read(opts.key, { start, end }), { status: 206, headers });
  }

  headers.set("Content-Length", String(info.size));
  if (request.method === "HEAD") return new Response(null, { status: 200, headers });
  return new Response(storage.read(opts.key), { status: 200, headers });
}

export const PRIVATE_NO_STORE = "private, no-store, max-age=0";
export const PUBLIC_IMMUTABLE = "public, max-age=31536000, immutable";
