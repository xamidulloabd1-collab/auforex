import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { appUrl, env, isMailConfigured } from "@/lib/env";
import { emailVerificationRequired, vercelOrigins } from "@/lib/env-schema";
import { prisma } from "@/lib/db/prisma";
import { MailDeliveryError, sendMail } from "@/lib/mail";
import { passwordResetEmail, verificationEmail } from "@/lib/mail/templates";
import { nameSchema, passwordSchema } from "@/lib/validations/auth";
import { devLanOrigin, requestOwnOrigin } from "./origins";

/** A mail that could not be sent becomes a clear 503 for the form instead of a generic 500. */
async function deliver(mail: Parameters<typeof sendMail>[0]) {
  try {
    await sendMail(mail);
  } catch (err) {
    if (err instanceof MailDeliveryError) {
      throw new APIError("SERVICE_UNAVAILABLE", {
        code: "MAIL_SEND_FAILED",
        message: "Xat yuborilmadi: pochta xizmati vaqtincha ishlamayapti. Birozdan so‘ng qayta urinib ko‘ring.",
      });
    }
    throw err;
  }
}

function firstIssue(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message ?? "Ma’lumotlar noto‘g‘ri";
}

function createAuth() {
  const e = env();
  const baseURL = appUrl();
  const mailReady = isMailConfigured();
  const requireEmailVerification = emailVerificationRequired(e, mailReady);
  const extraOrigins = (e.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  return betterAuth({
    appName: "AU Forex Academy",
    baseURL,
    secret: e.BETTER_AUTH_SECRET,
    // Configured address + extra origins + this project's Vercel domains + the address the
    // request itself was sent to (same-origin only). Cross-site requests remain rejected.
    trustedOrigins: (request) => [
      baseURL,
      ...extraOrigins,
      ...vercelOrigins(process.env),
      requestOwnOrigin(request),
      devLanOrigin(request?.headers.get("origin"), process.env.NODE_ENV),
    ],
    database: prismaAdapter(prisma, { provider: "postgresql" }),

    user: {
      additionalFields: {
        // input: false → can never be set by the client during sign-up / update.
        role: { type: ["USER", "SUPER_ADMIN"], required: false, defaultValue: "USER", input: false },
        status: { type: ["ACTIVE", "SUSPENDED"], required: false, defaultValue: "ACTIVE", input: false },
      },
    },
    verification: { modelName: "verificationToken" },

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: !requireEmailVerification,
      requireEmailVerification,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        // Better Auth logs a failure here and still answers "sent" (it never reveals whether the
        // address has an account); the reason is in the server log ([mail] …).
        await deliver({ to: user.email, ...passwordResetEmail(user.name, url) });
      },
    },

    emailVerification: {
      sendOnSignUp: false,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => {
        await deliver({ to: user.email, ...verificationEmail(user.name, url) });
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refresh daily
      // Always validate against the database so suspensions/revocations apply immediately.
      cookieCache: { enabled: false },
    },

    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      // Limits are per IP address. Many students share one address (mobile carriers' NAT, a
      // classroom Wi-Fi signing in when a lesson starts), and every registration also sends one
      // verification email from the form, so the limits leave room for a group signing up and in
      // together while still stopping scripted abuse (passwords: 8+ chars with letters and digits).
      customRules: {
        "/sign-in/email": { window: 60, max: 30 },
        "/sign-in/username": { window: 60, max: 30 },
        "/sign-up/email": { window: 60 * 10, max: 30 },
        "/request-password-reset": { window: 60 * 10, max: 10 },
        "/reset-password": { window: 60 * 10, max: 10 },
        "/send-verification-email": { window: 60 * 10, max: 30 },
        "/change-password": { window: 60 * 10, max: 10 },
      },
    },

    advanced: {
      useSecureCookies: baseURL.startsWith("https://"),
      cookiePrefix: "auf",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
      ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
      database: { generateId: false },
    },

    hooks: {
      // Server-side password/name policy (the client validates too, but is never trusted).
      before: createAuthMiddleware(async (ctx) => {
        const body = (ctx.body ?? {}) as Record<string, unknown>;
        const requiresMail =
          ctx.path === "/request-password-reset" ||
          ctx.path === "/send-verification-email" ||
          (ctx.path === "/sign-up/email" && requireEmailVerification);
        if (requiresMail && !mailReady) {
          throw new APIError("SERVICE_UNAVAILABLE", {
            code: "MAIL_NOT_CONFIGURED",
            message: "Pochta xizmati sozlanmagan. Administrator bilan bog‘laning.",
          });
        }
        if (ctx.path === "/sign-up/email") {
          // Logins (usernames) are assigned by the academy, not chosen at sign-up.
          if ("username" in body) throw new APIError("BAD_REQUEST", { message: "Login faqat administrator tomonidan beriladi" });
          const name = nameSchema.safeParse(body.name);
          if (!name.success) throw new APIError("BAD_REQUEST", { message: firstIssue(name) });
          const pwd = passwordSchema.safeParse(body.password);
          if (!pwd.success) throw new APIError("BAD_REQUEST", { message: firstIssue(pwd) });
        }
        if (ctx.path === "/reset-password" || ctx.path === "/change-password") {
          const pwd = passwordSchema.safeParse(body.newPassword);
          if (!pwd.success) throw new APIError("BAD_REQUEST", { message: firstIssue(pwd) });
        }
        if (ctx.path === "/update-user") {
          // Only allow profile fields; role/status are protected by `input: false` as well.
          if ("name" in body) {
            const name = nameSchema.safeParse(body.name);
            if (!name.success) throw new APIError("BAD_REQUEST", { message: firstIssue(name) });
          }
          if ("username" in body) {
            throw new APIError("BAD_REQUEST", { message: "Login faqat administrator tomonidan beriladi" });
          }
          if ("image" in body) {
            throw new APIError("BAD_REQUEST", { message: "Avatar faqat yuklash orqali o‘zgartiriladi" });
          }
        }
      }),
    },

    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await prisma.subscription.upsert({
              where: { userId: user.id },
              update: {},
              create: { userId: user.id, status: "FREE" },
            });
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const owner = await prisma.user.findUnique({
              where: { id: session.userId },
              select: { status: true },
            });
            if (!owner || owner.status === "SUSPENDED") {
              throw new APIError("FORBIDDEN", {
                code: "ACCOUNT_SUSPENDED",
                message: "Hisobingiz vaqtincha bloklangan. Administrator bilan bog‘laning.",
              });
            }
          },
        },
      },
    },

    plugins: [
      // Sign in with a login (e.g. the founder's "asadbek") as well as with email.
      username({ minUsernameLength: 3, maxUsernameLength: 30, displayUsername: false }),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { auth?: Auth };

/** Lazily-initialised Better Auth instance (keeps `next build` free of secrets). */
export function getAuth(): Auth {
  if (!globalForAuth.auth) globalForAuth.auth = createAuth();
  return globalForAuth.auth;
}

export type AuthSession = Auth["$Infer"]["Session"];
