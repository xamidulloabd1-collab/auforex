import { describe, expect, it } from "vitest";
import { classifyDbError, explainDbFailure, parseDbUrl, probeDb, withHostPort } from "../../scripts/lib/db-probe.mjs";

describe("database error classification (npm run db:fix, pre-dev check)", () => {
  it("recognises wrong password, missing database and a stopped server", () => {
    expect(classifyDbError({ code: "28P01", message: 'password authentication failed for user "postgres"' }).kind).toBe("auth");
    expect(classifyDbError({ code: "3D000", message: 'database "auforex" does not exist' }).kind).toBe("nodb");
    expect(classifyDbError({ code: "ECONNREFUSED", message: "connect ECONNREFUSED 127.0.0.1:5432" }).kind).toBe("refused");
    const both = new AggregateError([Object.assign(new Error("connect ECONNREFUSED ::1:5432"), { code: "ECONNREFUSED" })], "");
    expect(classifyDbError(both).kind).toBe("refused");
  });

  it("keeps credentials and database when moving to another port", () => {
    const moved = withHostPort("postgresql://postgres:p%40ss@localhost:5432/auforex?schema=public", "127.0.0.1", 5433);
    expect(parseDbUrl(moved)).toEqual({ host: "127.0.0.1", port: 5433, user: "postgres", password: "p@ss", database: "auforex" });
    expect(moved).toContain("?schema=public");
  });

  it("explains failures in plain Uzbek", () => {
    expect(explainDbFailure("auth", { host: "localhost", port: 5432, user: "postgres" })).toMatch(/parolni qabul qilmadi/);
    expect(explainDbFailure("refused", { host: "127.0.0.1", port: 5433 })).toMatch(/ishlamayapti/);
  });

  it("reports a closed port as “refused” without throwing", async () => {
    const res = await probeDb("postgresql://postgres:postgres@127.0.0.1:1/x", { timeoutMs: 1500 });
    expect(res.ok).toBe(false);
    expect(res.kind).toBe("refused");
  });
});
