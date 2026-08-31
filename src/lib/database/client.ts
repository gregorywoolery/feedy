import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  getDatabaseConnectionOptions,
  getDatabaseUrl,
} from "@/lib/database/config";
import * as schema from "@/lib/database/schema";

function createDatabaseConnection() {
  const databaseUrl = getDatabaseUrl();
  const options = { ...getDatabaseConnectionOptions(databaseUrl) };
  // Application tables are schema-qualified in Drizzle. Supabase's
  // transaction pooler can reuse upstream sessions between clients, so the
  // application runtime deliberately sends no session startup parameters.
  delete options.connection;
  const sqlClient = postgres(databaseUrl, options);

  return {
    sqlClient,
    database: drizzle(sqlClient, { schema }),
  };
}

type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

declare global {
  var __feedyDatabaseConnection__: DatabaseConnection | undefined;
}

function getConnection(): DatabaseConnection {
  // Vercel can freeze a function after a streamed request is abandoned. A
  // module-scoped Postgres.js pool would then retain the half-consumed socket
  // and poison later requests on the same warm instance. Supabase transaction
  // pooling is designed for transient serverless clients, so create one client
  // per query/transaction there. Postgres.js closes it through the configured
  // idle/max-lifetime bounds. Local and long-lived runtimes keep one shared
  // pool for lower connection overhead.
  if (process.env.VERCEL) {
    return createDatabaseConnection();
  }

  globalThis.__feedyDatabaseConnection__ ??= createDatabaseConnection();
  return globalThis.__feedyDatabaseConnection__;
}

export function getDatabaseClient() {
  return getConnection().database;
}

export function getSqlClient() {
  return getConnection().sqlClient;
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
