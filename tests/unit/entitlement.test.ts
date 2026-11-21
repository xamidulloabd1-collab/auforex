import { describe, expect, it } from "vitest";
import { accessLevelFor, canAccessPremium, effectiveStatus, isProEntitled } from "@/lib/subscription/entitlement";

const now = new Date("2026-11-20T12:00:00Z");

describe("subscription entitlement", () => {
  it("treats missing subscription as FREE", () => {
    expect(effectiveStatus(null, now)).toBe("FREE");
    expect(isProEntitled(undefined, now)).toBe(false);
  });

  it("accepts active PRO without expiry", () => {
    expect(isProEntitled({ status: "PRO_ACTIVE", expiresAt: null }, now)).toBe(true);
  });

  it("expires PRO once the expiry date passes", () => {
    const sub = { status: "PRO_ACTIVE" as const, expiresAt: new Date("2026-11-20T11:59:59Z") };
    expect(effectiveStatus(sub, now)).toBe("PRO_EXPIRED");
    expect(isProEntitled(sub, now)).toBe(false);
  });

  it("keeps PRO active before expiry", () => {
    expect(isProEntitled({ status: "PRO_ACTIVE", expiresAt: new Date("2026-12-01T00:00:00Z") }, now)).toBe(true);
  });

  it("never entitles cancelled or expired statuses", () => {
    expect(isProEntitled({ status: "PRO_CANCELLED", expiresAt: null }, now)).toBe(false);
    expect(isProEntitled({ status: "PRO_EXPIRED", expiresAt: null }, now)).toBe(false);
  });

  it("derives access levels from role and subscription independently", () => {
    expect(accessLevelFor(null, null)).toBe("GUEST");
    expect(accessLevelFor({ role: "USER" }, null)).toBe("USER");
    expect(accessLevelFor({ role: "USER" }, { status: "PRO_ACTIVE", expiresAt: null })).toBe("PRO");
    expect(accessLevelFor({ role: "SUPER_ADMIN" }, null)).toBe("ADMIN");
    expect(canAccessPremium("USER")).toBe(false);
    expect(canAccessPremium("GUEST")).toBe(false);
    expect(canAccessPremium("PRO")).toBe(true);
    expect(canAccessPremium("ADMIN")).toBe(true);
  });
});
