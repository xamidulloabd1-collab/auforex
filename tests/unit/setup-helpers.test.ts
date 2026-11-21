import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { devLanOrigin } from "@/lib/auth/origins";
import { getEnvValue, isWeakSecret, localDbPort, setEnvValue, strongPassword } from "../../scripts/lib/env-file.mjs";

describe("devLanOrigin (phone on the same Wi-Fi during development)", () => {
  it("allows private network and localhost origins in development", () => {
    for (const o of ["http://192.168.1.23:3000", "http://10.0.0.5:3000", "http://172.20.1.4:3000", "http://localhost:3000", "http://127.0.0.1:3000"]) {
      expect(devLanOrigin(o, "development")).toBe(o);
    }
  });
  it("never widens origins in production", () => {
    expect(devLanOrigin("http://192.168.1.23:3000", "production")).toBeNull();
  });
  it("rejects public hosts, https tricks and junk", () => {
    expect(devLanOrigin("http://evil.example:3000", "development")).toBeNull();
    expect(devLanOrigin("http://192.168.1.23.evil.example", "development")).toBeNull();
    expect(devLanOrigin("http://172.32.0.1:3000", "development")).toBeNull();
    expect(devLanOrigin("https://192.168.1.23", "development")).toBeNull();
    expect(devLanOrigin("not a url", "development")).toBeNull();
    expect(devLanOrigin(null, "development")).toBeNull();
  });
});

describe(".env helpers used by `npm run setup`", () => {
  const sample = 'DATABASE_URL="postgresql://x"\r\nBETTER_AUTH_SECRET="replace-with-a-long-random-secret-at-least-32-chars"\r\nFOUNDER_PASSWORD=""\r\n';
  it("reads quoted values", () => {
    expect(getEnvValue(sample, "DATABASE_URL")).toBe("postgresql://x");
    expect(getEnvValue(sample, "FOUNDER_PASSWORD")).toBe("");
    expect(getEnvValue(sample, "MISSING")).toBeUndefined();
  });
  it("replaces a value in place and keeps Windows line endings", () => {
    const out = setEnvValue(sample, "FOUNDER_PASSWORD", "Abc-123456789x");
    expect(getEnvValue(out, "FOUNDER_PASSWORD")).toBe("Abc-123456789x");
    expect(out.split("\r\n")).toHaveLength(sample.split("\r\n").length);
    expect(getEnvValue(out, "DATABASE_URL")).toBe("postgresql://x");
  });
  it("appends missing keys", () => {
    expect(getEnvValue(setEnvValue("A=1\n", "B", "2"), "B")).toBe("2");
  });
  it("treats the example secret as weak", () => {
    expect(isWeakSecret(getEnvValue(sample, "BETTER_AUTH_SECRET"))).toBe(true);
    expect(isWeakSecret("")).toBe(true);
    expect(isWeakSecret(randomBytes(48).toString("base64url"))).toBe(false);
  });
  it("generates passwords that pass the account rules", () => {
    for (let i = 0; i < 50; i++) {
      const p = strongPassword(randomBytes);
      expect(p.length).toBeGreaterThanOrEqual(12);
      expect(p).toMatch(/[A-Za-z]/);
      expect(p).toMatch(/[0-9]/);
    }
  });
});

describe("DB_PORT follows DATABASE_URL", () => {
  it("reads the port of a local database", () => {
    expect(localDbPort("postgresql://postgres:postgres@localhost:5433/auforex")).toBe("5433");
    expect(localDbPort("postgresql://postgres:postgres@127.0.0.1/auforex")).toBe("5432");
  });
  it("ignores remote databases and junk", () => {
    expect(localDbPort("postgresql://u:p@db.example.com:6543/x")).toBeUndefined();
    expect(localDbPort("")).toBeUndefined();
  });
});
