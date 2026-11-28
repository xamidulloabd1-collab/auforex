import { describe, expect, it } from "vitest";
import { databaseTarget, runtimeDatabaseUrl, usesPooledDatabase } from "@/lib/db/prisma";

describe("Prisma Postgres connection selection", () => {
  it("uses the pooled Prisma Postgres hostname on Vercel when only the direct URL is configured", () => {
    const source = {
      VERCEL: "1",
      DATABASE_URL: "postgresql://test-user:p%40ss@db.prisma.io:5432/postgres?sslmode=require",
    };

    expect(runtimeDatabaseUrl(source)).toBe(
      "postgresql://test-user:p%40ss@pooled.db.prisma.io:5432/postgres?sslmode=require",
    );
    expect(usesPooledDatabase(source)).toBe(true);
    expect(databaseTarget(source)).toBe("pooled.db.prisma.io:5432/postgres (DATABASE_URL (pooled))");
  });

  it("prefers an explicit pooled URL and does not rewrite other hosts or local connections", () => {
    const explicit = {
      VERCEL: "1",
      DATABASE_URL: "postgresql://user:pass@db.prisma.io/postgres",
      DATABASE_URL_POOLED: "postgresql://user:pass@pool.example.com/postgres",
    };
    const otherHost = {
      VERCEL: "1",
      DATABASE_URL: "postgresql://user:pass@db.example.com/postgres",
    };
    const local = {
      DATABASE_URL: "postgresql://user:pass@db.prisma.io/postgres",
    };

    expect(runtimeDatabaseUrl(explicit)).toBe(explicit.DATABASE_URL_POOLED);
    expect(runtimeDatabaseUrl(otherHost)).toBe(otherHost.DATABASE_URL);
    expect(runtimeDatabaseUrl(local)).toBe(local.DATABASE_URL);
    expect(usesPooledDatabase(otherHost)).toBe(false);
  });
});
