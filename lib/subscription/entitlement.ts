/**
 * Pure entitlement logic (no I/O) — shared by server checks and unit tests.
 */
export type SubscriptionStatusValue = "FREE" | "PRO_ACTIVE" | "PRO_EXPIRED" | "PRO_CANCELLED";

export type SubscriptionLike = {
  status: SubscriptionStatusValue;
  expiresAt: Date | null;
};

/** Effective status at `now` — an active subscription past its expiry is treated as expired. */
export function effectiveStatus(
  sub: SubscriptionLike | null | undefined,
  now: Date = new Date(),
): SubscriptionStatusValue {
  if (!sub) return "FREE";
  if (sub.status === "PRO_ACTIVE" && sub.expiresAt && sub.expiresAt.getTime() <= now.getTime()) {
    return "PRO_EXPIRED";
  }
  return sub.status;
}

export function isProEntitled(sub: SubscriptionLike | null | undefined, now: Date = new Date()) {
  return effectiveStatus(sub, now) === "PRO_ACTIVE";
}

export type AccessLevel = "GUEST" | "USER" | "PRO" | "ADMIN";

export type RoleValue = "USER" | "SUPER_ADMIN";

/** SUPER_ADMIN is the only administrative role (single management panel at /super-admin). */
export function isAdminRole(role: RoleValue | null | undefined) {
  return role === "SUPER_ADMIN";
}

export function accessLevelFor(
  user: { role: RoleValue } | null | undefined,
  sub: SubscriptionLike | null | undefined,
  now: Date = new Date(),
): AccessLevel {
  if (!user) return "GUEST";
  if (isAdminRole(user.role)) return "ADMIN";
  return isProEntitled(sub, now) ? "PRO" : "USER";
}

/** Admins can always review premium content; otherwise PRO entitlement is required. */
export function canAccessPremium(level: AccessLevel) {
  return level === "PRO" || level === "ADMIN";
}

export const SUBSCRIPTION_LABELS: Record<SubscriptionStatusValue, string> = {
  FREE: "Bepul",
  PRO_ACTIVE: "PRO faol",
  PRO_EXPIRED: "PRO muddati tugagan",
  PRO_CANCELLED: "PRO bekor qilingan",
};
