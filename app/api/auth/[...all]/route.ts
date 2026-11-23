import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";
import { databaseProblem } from "@/lib/data/safe";
import { databaseTarget } from "@/lib/db/prisma";
import { checkEnv } from "@/lib/env";

const handler = toNextJsHandler((request: Request) => getAuth().handler(request));

/**
 * A broken server configuration (e.g. BETTER_AUTH_SECRET shorter than 32 characters, or a
 * site address without https://) must not surface as an unexplained 500: the visitor gets a
 * clear message, the server log names the variables to fix (never their values).
 */
async function guarded(request: Request, run: (r: Request) => Promise<Response>) {
  const config = checkEnv(process.env);
  if (!config.ok) {
    const where = process.env.VERCEL
      ? "Vercel → Settings → Environment Variables, so‘ng Redeploy"
      : "lokal .env fayllarida. “npm run doctor” qaysi qiymat qaysi fayldan kelayotganini ko‘rsatadi " +
        "(npm run dev tartibi: .env.development.local → .env.local → .env.development → .env; bo‘sh qiymat ham pastdagisini bekor qiladi). " +
        "Tuzatgach serverni qayta ishga tushiring";
    console.error(
      `[auth] Server sozlamalari noto‘g‘ri — kirish ishlamaydi. Tuzating: ${where}:\n` +
        config.issues.map((i) => `  • ${i}`).join("\n"),
    );
    return Response.json(
      { code: "SERVER_MISCONFIGURED", message: "Sayt sozlamalarida xatolik bor. Administrator xabardor qilindi." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  try {
    return await run(request);
  } catch (err) {
    if (databaseProblem(err) === "unreachable") {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(
        `[auth] Ma’lumotlar bazasiga ulanib bo‘lmadi: ${databaseTarget()} — ${reason}. ` +
          (process.env.VERCEL
            ? "Tekshiring: /api/health"
            : "Tekshiring: npm run doctor (.env fayllari o‘zgargan bo‘lsa, npm run dev ni qayta ishga tushiring — o‘chirilgan qiymatlar server xotirasida qoladi)"),
      );
      return Response.json(
        { code: "DATABASE_UNAVAILABLE", message: "Ma’lumotlar bazasiga ulanib bo‘lmadi. Birozdan so‘ng qayta urinib ko‘ring." },
        { status: 503, headers: { "cache-control": "no-store", "retry-after": "30" } },
      );
    }
    console.error("[auth] kutilmagan xato", err);
    return Response.json(
      { code: "SERVER_ERROR", message: "Serverda vaqtinchalik xatolik. Birozdan so‘ng qayta urinib ko‘ring." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}

export const GET = (request: Request) => guarded(request, handler.GET);
export const POST = (request: Request) => guarded(request, handler.POST);
