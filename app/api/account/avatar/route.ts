import { NextResponse } from "next/server";
import { assertSameOrigin, handleRouteError } from "@/lib/api";
import { assertUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { deleteStoredFile, storeUpload } from "@/lib/storage";
import { publicMediaUrl } from "@/lib/storage/keys";

/** Uploads the signed-in user's avatar (raw image body, validated by magic bytes). */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const viewer = await assertUser();
    rateLimit(`avatar:${viewer.id}`, 10, 10 * 60_000);
    const stored = await storeUpload("avatar", request.body);
    const previous = await prisma.user.findUnique({ where: { id: viewer.id }, select: { image: true } });
    const url = publicMediaUrl(stored.key)!;
    await prisma.user.update({ where: { id: viewer.id }, data: { image: url } });
    const prevKey = previous?.image?.startsWith("/api/media/") ? previous.image.slice("/api/media/".length) : null;
    if (prevKey) await deleteStoredFile(prevKey);
    return NextResponse.json({ url });
  } catch (err) {
    return handleRouteError(err);
  }
}
