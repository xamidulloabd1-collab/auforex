
import "server-only";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

type PrismaClientInstance = PrismaClient;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientInstance;
  prismaPool?: Pool;
};

function createPrismaClient(): PrismaClientInstance {
  const connectionString =
    process.env.DATABASE_URL_POOLED ||
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("Database connection URL is missing");
  }

  const pool =
    globalForPrisma.prismaPool ??
    new Pool({
      connectionString,
      max: 2,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });

  globalForPrisma.prismaPool = pool;

  return new PrismaClient({
    adapter: new PrismaPg(pool),
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export function getPrisma(): PrismaClientInstance {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}

export const prisma: PrismaClientInstance = new Proxy(
  {} as PrismaClientInstance,
  {
    get(_target, prop) {
      const client = getPrisma();
      const value = Reflect.get(client, prop);

      return typeof value === "function"
        ? value.bind(client)
        : value;
    },
  }
);
