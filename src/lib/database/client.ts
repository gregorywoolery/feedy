import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";

import { getDatabasePoolOptions, getDatabaseUrl } from "@/lib/database/config";
import * as schema from "@/lib/database/schema";

function createDatabaseConnection() {
  const databaseUrl = getDatabaseUrl();
  const pool = new Pool(getDatabasePoolOptions(databaseUrl));
  pool.on("error", (error) => {
    console.error("An idle database connection failed.", error);
  });
  // Vercel keeps the runtime alive until idle clients have been released.
  if (process.env.VERCEL) attachDatabasePool(pool);

  return {
    pool,
    database: drizzle(pool, { schema }),
  };
}

type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

declare global {
  var __feedyPgConnection__: DatabaseConnection | undefined;
}

function getConnection(): DatabaseConnection {
  // One bounded pool serves all repository calls in a warm runtime.
  globalThis.__feedyPgConnection__ ??= createDatabaseConnection();
  return globalThis.__feedyPgConnection__;
}

export function getDatabaseClient() {
  return getConnection().database;
}

export function getDatabasePool() {
  return getConnection().pool;
}

/**
 * Keep repository call sites concise while deferring environment validation and
 * socket creation until a query actually runs. Next.js imports route modules at
 * build time, when a runtime database URL is intentionally not required.
 */
export const db = new Proxy({} as DatabaseConnection["database"], {
  get(_target, property) {
    const database = getDatabaseClient();
    const value = Reflect.get(database, property, database);

    return typeof value === "function" ? value.bind(database) : value;
  },
});
