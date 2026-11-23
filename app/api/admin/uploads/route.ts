import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, handleRouteError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { assertAdmin } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { abortUpload, completeUpload, startUpload } from "@/lib/storage/direct";

const kindSchema = z.enum(["video", "book", "cover", "thumbnail", "founder"]);
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("init"), kind: kindSchema, size: z.number().int().positive(), name: z.string().max(300), type: z.string().max(100) }),
  z.object({ action: z.literal("complete"), token: z.string().max(4000), etags: z.array(z.string().max(200)).max(10_000).optional() }),
  z.object({ action: z.literal("abort"), token: z.string().max(4000) }),
]);

/**
 * Super admin file uploads straight to object storage (videos, books, covers, founder photo).
 * Only super admins; the bucket credentials never leave the server — the browser only gets
 * short-lived URLs for one object.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await assertAdmin();
    rateLimit(`admin-direct-upload:${admin.id}`, 300, 10 * 60_000);
    const body = bodySchema.parse(await request.json());
    if (body.action === "init") return NextResponse.json(await startUpload(body, admin.id));
    if (body.action === "abort") {
      await abortUpload(body.token, admin.id);
      return NextResponse.json({ ok: true });
    }
    const stored = await completeUpload(body.token, admin.id, body.etags);
    await audit({
      actorId: admin.id,
      action: "upload.create",
      targetType: "File",
      targetId: stored.key,
      summary: `${stored.mime} · ${Math.round(stored.size / 1024)} KB`,
    });
    return NextResponse.json(stored);
  } catch (err) {
    return handleRouteError(err);
  }
}
