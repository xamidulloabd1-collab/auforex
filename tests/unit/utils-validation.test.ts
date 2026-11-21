import { describe, expect, it } from "vitest";
import { formatDate, formatDuration, fromDateTimeLocalValue, slugify, toDateTimeLocalValue } from "@/lib/utils";
import { passwordSchema, registerSchema } from "@/lib/validations/auth";

describe("formatting", () => {
  it("slugifies Uzbek text", () => {
    expect(slugify("O‘rganishni boshlash")).toBe("organishni-boshlash");
    expect(slugify("Bozorni zabt etish — 1-kitob")).toBe("bozorni-zabt-etish-1-kitob");
  });
  it("formats durations", () => {
    expect(formatDuration(125)).toBe("2:05");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(null)).toBe("—");
  });
  it("formats dates in Tashkent time with Uzbek months", () => {
    expect(formatDate(new Date("2026-11-20T20:00:00Z"))).toBe("21-noyabr, 2026");
  });
  it("round-trips datetime-local values in Tashkent time", () => {
    const d = fromDateTimeLocalValue("2026-12-01T09:30")!;
    expect(d.toISOString()).toBe("2026-12-01T04:30:00.000Z");
    expect(toDateTimeLocalValue(d)).toBe("2026-12-01T09:30");
  });
});

describe("auth validation", () => {
  it("enforces password policy", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("onlyletters").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
    expect(passwordSchema.safeParse("Trader2026").success).toBe(true);
  });
  it("requires matching passwords and consent", () => {
    const base = { name: "Ali Valiyev", email: "Ali@Example.com", password: "Trader2026", confirmPassword: "Trader2026", acceptTerms: true };
    const ok = registerSchema.safeParse(base);
    expect(ok.success).toBe(true);
    expect(ok.success && ok.data.email).toBe("ali@example.com");
    expect(registerSchema.safeParse({ ...base, confirmPassword: "Other2026" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, name: "<script>" }).success).toBe(false);
  });
});
