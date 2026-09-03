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
  // Reuse one bounded pool per warm runtime. Creating a client for every
  // repository call leaves many independent idle sockets behind and can
  // exhaust Supabase's shared transaction-pooler limit during image bursts.
  // Postgres.js still retires idle and old connections using the configured
  // idle_timeout and max_lifetime values.
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
