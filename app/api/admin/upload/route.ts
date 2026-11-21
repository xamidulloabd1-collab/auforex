import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, handleRouteError } from "@/lib/api";
import { assertAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { storeUpload } from "@/lib/storage";

const kindSchema = z.enum(["video", "book", "cover", "thumbnail", "founder"]);

/**
 * Admin uploads. The raw file is streamed straight to storage (no buffering), its
 * type is detected from magic bytes and size limits are enforced while streaming.
 * Returns the private storage key, which the admin form then saves with the record.
 */
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await assertAdmin();
    rateLimit(`admin-upload:${admin.id}`, 60, 10 * 60_000);
    const kind = kindSchema.parse(new URL(request.url).searchParams.get("kind"));
    const stored = await storeUpload(kind, request.body);
    await audit({
      actorId: admin.id,
      action: "upload.create",
      targetType: "File",
      targetId: stored.key,
      summary: `${kind} · ${Math.round(stored.size / 1024)} KB`,
    });
    return NextResponse.json(stored);
  } catch (err) {
    return handleRouteError(err);
  }
}
