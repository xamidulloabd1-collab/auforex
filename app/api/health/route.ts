import { prisma } from "@/lib/db/prisma";

/** Liveness + database check for the hosting platform (Railway healthcheck path: /api/health). */
export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "cache-control": "no-store" };
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers });
  } catch {
    return Response.json({ status: "database_unavailable" }, { status: 503, headers });
  }
}
