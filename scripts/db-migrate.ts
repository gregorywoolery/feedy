import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  getDatabaseConnectionOptions,
  getDatabaseSchema,
  getDatabaseUrl,
} from "../src/lib/database/config";

async function main() {
  loadEnvConfig(process.cwd());
  const databaseUrl = getDatabaseUrl();
  const databaseSchema = getDatabaseSchema();
  const sqlClient = postgres(databaseUrl, {
    ...getDatabaseConnectionOptions(databaseUrl),
    max: 1,
  });

  try {
    await sqlClient.unsafe(`create schema if not exists "${databaseSchema}"`);
    await migrate(drizzle(sqlClient), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
      migrationsSchema:
        databaseSchema === "public"
          ? "drizzle"
          : `${databaseSchema}_migrations`,
    });
    console.log("Database migrations complete.");
  } finally {
    await sqlClient.end();
  }
}

main().catch((error: unknown) => {
  console.error("Database migration failed.", error);
  process.exitCode = 1;
});
