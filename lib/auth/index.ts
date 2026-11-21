import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { appUrl, env, isMailConfigured } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { sendMail } from "@/lib/mail";
import { passwordResetEmail, verificationEmail } from "@/lib/mail/templates";
import { nameSchema, passwordSchema } from "@/lib/validations/auth";
import { devLanOrigin } from "./origins";

function firstIssue(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message ?? "Ma’lumotlar noto‘g‘ri";
}

function createAuth() {
  const e = env();
  const baseURL = appUrl();
  const mailReady = isMailConfigured();
  const requireEmailVerification = mailReady && e.REQUIRE_EMAIL_VERIFICATION !== "false";
  const extraOrigins = (e.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  return betterAuth({
    appName: "AU Forex Academy",
    baseURL,
    secret: e.BETTER_AUTH_SECRET,
    trustedOrigins: (request) => [baseURL, ...extraOrigins, devLanOrigin(request?.headers.get("origin"), process.env.NODE_ENV)],
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
        const mail = passwordResetEmail(user.name, url);
        await sendMail({ to: user.email, ...mail });
      },
    },

    emailVerification: {
      sendOnSignUp: mailReady,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => {
        const mail = verificationEmail(user.name, url);
        await sendMail({ to: user.email, ...mail });
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
      customRules: {
        "/sign-in/email": { window: 60, max: 15 },
        "/sign-in/username": { window: 60, max: 15 },
        "/sign-up/email": { window: 60 * 10, max: 10 },
        "/request-password-reset": { window: 60 * 10, max: 5 },
        "/reset-password": { window: 60 * 10, max: 10 },
        "/send-verification-email": { window: 60 * 10, max: 5 },
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
