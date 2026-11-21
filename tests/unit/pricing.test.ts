import { describe, expect, it } from "vitest";
import { discountPercent, formatPrice } from "@/lib/pricing";
import { subscriptionSettingsSchema, DEFAULT_SETTINGS } from "@/lib/settings/schema";

const plain = (s: string) => s.replace(/\s/g, " ");

describe("pricing", () => {
  it("groups thousands with spaces", () => {
    expect(plain(formatPrice(199_000))).toBe("199 000");
    expect(plain(formatPrice(1_200_000))).toBe("1 200 000");
    expect(plain(formatPrice(0))).toBe("0");
  });

  it("computes the discount only when the old price is higher", () => {
    expect(discountPercent(199_000, 1_200_000)).toBe(83);
    expect(discountPercent(199_000, null)).toBeNull();
    expect(discountPercent(199_000, 199_000)).toBeNull();
    expect(discountPercent(199_000, 100_000)).toBeNull();
  });

  it("ships the requested defaults: 1 200 000 → 199 000 via Telegram", () => {
    const d = DEFAULT_SETTINGS.subscription;
    expect(d.price).toBe(199_000);
    expect(d.oldPrice).toBe(1_200_000);
    expect(d.purchaseUrl).toBe("https://t.me/uktambekovv");
    expect(subscriptionSettingsSchema.safeParse(d).success).toBe(true);
  });

  it("rejects non-https purchase links", () => {
    const d = DEFAULT_SETTINGS.subscription;
    expect(subscriptionSettingsSchema.safeParse({ ...d, purchaseUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(subscriptionSettingsSchema.safeParse({ ...d, purchaseUrl: "http://t.me/x" }).success).toBe(false);
  });
});
