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

  let dbUrl = getEnv("DATABASE_URL") || process.env.DATABASE_URL || "";

  // Ensure connection limits and pooling flags for Supabase pooler in serverless environments
  if (dbUrl && dbUrl.includes("pooler.supabase.com")) {
    if (!dbUrl.includes("connection_limit")) {
      const separator = dbUrl.includes("?") ? "&" : "?";
      dbUrl = `${dbUrl}${separator}connection_limit=1`;
    }
    if (dbUrl.includes(":6543") && !dbUrl.includes("pgbouncer=true")) {
      dbUrl = `${dbUrl}&pgbouncer=true`;
    }
  }

  const client = new PrismaClient({
    datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
    log: getEnv("NODE_ENV") === "development" ? ["warn", "error"] : ["error"],
  });

  // Always cache client on globalThis to prevent connection leaks across lambdas
  globalThis.prismaGlobal = client;

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
