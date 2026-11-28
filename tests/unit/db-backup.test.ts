import { describe, expect, it } from "vitest";
// @ts-expect-error — plain ESM script without type declarations
import { compareCounts, pgEnv } from "../../scripts/db-backup.mjs";

describe("database backup check", () => {
  it("passes the connection to the tools as PG* variables (never on the command line)", () => {
    expect(pgEnv("postgres://u%40x:p%2Fw@db.prisma.io:5432/postgres?sslmode=require")).toEqual({
      PGHOST: "db.prisma.io",
      PGPORT: "5432",
      PGUSER: "u@x",
      PGPASSWORD: "p/w",
      PGDATABASE: "postgres",
      PGSSLMODE: "require",
    });
    expect(pgEnv("postgresql://postgres:pw@127.0.0.1/test").PGSSLMODE).toBe("disable");
    expect(() => pgEnv("mysql://a:b@host/db")).toThrow();
  });

  it("accepts the backup only when every table restored with the same row count", () => {
    expect(compareCounts({ User: 7, Lesson: 3 }, { User: 7, Lesson: 3 }).ok).toBe(true);
    const lost = compareCounts({ User: 7, Lesson: 3 }, { User: 7, Lesson: 2 });
    expect(lost.ok).toBe(false);
    expect(lost.rows.find((r: { table: string }) => r.table === "Lesson").status).toBe("different");
    expect(compareCounts({ User: 7, Lesson: 3 }, { User: 7 }).ok).toBe(false);
  });

  it("tolerates tables written on every request (sessions, rate limits) changing after the snapshot", () => {
    const r = compareCounts({ User: 7, Session: 12, RateLimit: 9 }, { User: 7, Session: 11, RateLimit: 4 });
    expect(r.ok).toBe(true);
    expect(r.rows.filter((x: { status: string }) => x.status === "volatile")).toHaveLength(2);
  });
});
