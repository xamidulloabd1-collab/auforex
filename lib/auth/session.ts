import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import {
  accessLevelFor,
  isAdminRole,
  type RoleValue,
  canAccessPremium,
  effectiveStatus,
  type AccessLevel,
  type SubscriptionStatusValue,
} from "@/lib/subscription/entitlement";

export type Viewer = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  username: string | null;
  role: RoleValue;
  createdAt: Date;
  accessLevel: AccessLevel;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  hasPremium: boolean;
  subscription: {
    status: SubscriptionStatusValue;
    startedAt: Date | null;
    expiresAt: Date | null;
  };
  sessionId: string;
};

/**
 * Resolves the signed-in user from the session cookie.
 * Role, account status and subscription are always re-read from the database —
 * nothing client-provided is trusted for authorization.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  let session;
  try {
    session = await getAuth().api.getSession({ headers: await headers() });
  } catch {
    return null;
  }
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      emailVerified: true,
      image: true,
      role: true,
      status: true,
      createdAt: true,
      subscription: { select: { status: true, startedAt: true, expiresAt: true } },
    },
  });
  if (!user || user.status !== "ACTIVE") return null;

  const sub = user.subscription;
  const accessLevel = accessLevelFor(user, sub);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    emailVerified: user.emailVerified,
    image: user.image,
    role: user.role,
    createdAt: user.createdAt,
    accessLevel,
    isAdmin: isAdminRole(user.role),
    isSuperAdmin: user.role === "SUPER_ADMIN",
    hasPremium: canAccessPremium(accessLevel),
    subscription: {
      status: effectiveStatus(sub),
      startedAt: sub?.startedAt ?? null,
      expiresAt: sub?.expiresAt ?? null,
    },
    sessionId: session.session.id,
  };
});

/** Redirects guests to the login page (with a safe return path). */
export async function requireUser(nextPath?: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) {
    const qs = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/login${qs}`);
  }
  return viewer;
}

/** Super admin panel pages: everyone else gets a 404 so the panel is not advertised. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=%2Fsuper-admin");
  if (!viewer.isAdmin) notFound();
  return viewer;
}

/** Alias kept for readability in super-admin pages. */
export const requireSuperAdmin = requireAdmin;

export class AuthorizationError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
  }
}

/** For server actions and route handlers: throws instead of redirecting. */
export async function assertAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new AuthorizationError(401, "Tizimga kiring");
  if (!viewer.isAdmin) throw new AuthorizationError(403, "Ruxsat yo‘q");
  return viewer;
}

export const assertSuperAdmin = assertAdmin;

export async function assertUser(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new AuthorizationError(401, "Tizimga kiring");
  return viewer;
}
