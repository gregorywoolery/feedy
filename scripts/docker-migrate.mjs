import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required to run container migrations.");
  }

  const parsed = new URL(value);
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL.");
  }

  return value;
}

function sslOption(value) {
  const mode = new URL(value).searchParams.get("sslmode")?.toLowerCase();

  switch (mode) {
    case undefined:
    case null:
    case "disable":
      return false;
    case "allow":
    case "prefer":
    case "require":
    case "verify-full":
      return mode;
    default:
      throw new Error(`Unsupported DATABASE_URL sslmode: ${mode}`);
  }
}

function databaseSchema() {
  const value = process.env.DATABASE_SCHEMA?.trim() || "public";
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) {
    throw new Error("DATABASE_SCHEMA is invalid.");
  }
  return value;
}

async function main() {
  const value = databaseUrl();
  const schema = databaseSchema();
  const sql = postgres(value, {
    connect_timeout: 10,
    idle_timeout: 20,
    max: 1,
    prepare: false,
    ssl: sslOption(value),
    connection: {
      application_name: "feedy",
      search_path: [...new Set([schema, "public"])].join(","),
    },
  });

  try {
    await sql.unsafe(`create schema if not exists "${schema}"`);
    await migrate(drizzle(sql), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
      migrationsSchema: schema === "public" ? "drizzle" : `${schema}_migrations`,
    });
    console.log("Database migrations complete.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("Database migration failed.", error);
  process.exitCode = 1;
});
