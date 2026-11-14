import { PrismaClient } from "@prisma/client";
import { getEnv } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

function getPrismaClient(): PrismaClient {
  if (globalThis.prismaGlobal) {
    return globalThis.prismaGlobal;
  }

  const dbUrl = getEnv("DATABASE_URL") || process.env.DATABASE_URL;

  const client = new PrismaClient({
    datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
    log: getEnv("NODE_ENV") === "development" ? ["warn", "error"] : ["error"],
  });

  if (process.env.NODE_ENV !== "production") {
    globalThis.prismaGlobal = client;
  }

  return client;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const val = (client as any)[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});

export default prisma;
