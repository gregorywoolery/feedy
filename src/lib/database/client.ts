import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  getDatabaseConnectionOptions,
  getDatabaseUrl,
} from "@/lib/database/config";
import * as schema from "@/lib/database/schema";

function createDatabaseConnection() {
  const databaseUrl = getDatabaseUrl();
  const options = getDatabaseConnectionOptions(databaseUrl);
  const sqlClient = postgres(databaseUrl, {
    ...options,
    // Application tables are schema-qualified in Drizzle. Avoid a session
    // search_path here because Supabase's transaction pooler can reuse the
    // upstream connection with different session state between requests.
    connection: { application_name: "feedy" },
  });

  return {
    sqlClient,
    database: drizzle(sqlClient, { schema }),
  };
}

type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

declare global {
  var __feedyDatabaseConnection__: DatabaseConnection | undefined;
}

let productionConnection: DatabaseConnection | undefined;

function getConnection(): DatabaseConnection {
  if (process.env.NODE_ENV !== "production") {
    globalThis.__feedyDatabaseConnection__ ??= createDatabaseConnection();
    return globalThis.__feedyDatabaseConnection__;
  }

  productionConnection ??= createDatabaseConnection();
  return productionConnection;
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
