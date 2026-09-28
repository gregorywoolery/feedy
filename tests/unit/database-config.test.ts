import {
  getDatabaseConnectionOptions,
  getDatabaseSchema,
  getDatabaseUrl,
} from "@/lib/database/config";
import { describe, expect, it } from "vitest";

describe("database configuration", () => {
  it("uses direct connection URLs in the documented precedence order", () => {
    const environment = {
      DATABASE_URL:
        "postgresql://direct:secret@db:5432/direct_db?sslmode=disable",
      POSTGRES_URL: "postgresql://postgres:secret@db:5432/postgres_db",
      SUPABASE_DB_URL:
        "postgresql://supabase:secret@db.example.com:5432/supabase_db?sslmode=require",
    };

    expect(getDatabaseUrl(environment)).toBe(environment.DATABASE_URL);
    expect(
      getDatabaseUrl({
        POSTGRES_URL: environment.POSTGRES_URL,
        SUPABASE_DB_URL: environment.SUPABASE_DB_URL.replace(
          "sslmode=require",
          "sslmode=verify-full",
        ),
      }),
    ).toBe(environment.POSTGRES_URL);
    expect(
      getDatabaseUrl({ SUPABASE_DB_URL: environment.SUPABASE_DB_URL }),
    ).toBe(
      environment.SUPABASE_DB_URL.replace(
        "sslmode=require",
        "sslmode=verify-full",
      ),
    );
  });

  it("builds an encoded TLS-enabled URL from split Supabase values", () => {
    const databaseUrl = getDatabaseUrl({
      SUPABASE_DB_HOST: "db.example.supabase.co",
      SUPABASE_DB_PORT: "6543",
      SUPABASE_DB_NAME: "postgres",
      SUPABASE_DB_USER: "postgres.project",
      SUPABASE_DB_PASSWORD: " p@ss word/with?symbols ",
    });
    const parsed = new URL(databaseUrl);

    expect(parsed.hostname).toBe("db.example.supabase.co");
    expect(parsed.port).toBe("6543");
    expect(parsed.pathname).toBe("/postgres");
    expect(decodeURIComponent(parsed.username)).toBe("postgres.project");
    expect(decodeURIComponent(parsed.password)).toBe(
      " p@ss word/with?symbols ",
    );
    expect(parsed.searchParams.get("sslmode")).toBe("verify-full");
  });

  it("uses port 5432 for split Supabase configuration by default", () => {
    const parsed = new URL(
      getDatabaseUrl({
        SUPABASE_DB_HOST: "db.example.supabase.co",
        SUPABASE_DB_NAME: "postgres",
        SUPABASE_DB_USER: "postgres",
        SUPABASE_DB_PASSWORD: "secret",
      }),
    );

    expect(parsed.port).toBe("5432");
  });

  it("fails clearly for incomplete or absent production configuration", () => {
    expect(() =>
      getDatabaseUrl({
        SUPABASE_DB_HOST: "db.example.supabase.co",
        NODE_ENV: "production",
      }),
    ).toThrow(/Incomplete split Supabase database configuration/);
    expect(() => getDatabaseUrl({ NODE_ENV: "production" })).toThrow(
      /Database configuration is missing/,
    );
    expect(() =>
      getDatabaseUrl({
        DATABASE_URL:
          "postgresql://postgres:secret@db.example.supabase.co:5432/postgres",
      }),
    ).toThrow(/must include sslmode=verify-full/);
  });

  it("provides a non-networking fallback URL while unit tests import modules", () => {
    expect(getDatabaseUrl({ NODE_ENV: "test" })).toBe(
      "postgresql://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable",
    );
  });

  it("derives local and Supabase SSL behavior from sslmode", () => {
    const localOptions = getDatabaseConnectionOptions(
      "postgresql://feedy:feedy@localhost:5433/feedy?sslmode=disable",
      {},
    );
    const supabaseOptions = getDatabaseConnectionOptions(
      "postgresql://postgres:secret@db.example.supabase.co:5432/postgres?sslmode=require",
      {},
    );

    expect(localOptions).toMatchObject({ ssl: false, prepare: false });
    expect(supabaseOptions).toMatchObject({
      ssl: "verify-full",
      prepare: false,
    });
  });

  it("uses bounded connection settings and validates overrides", () => {
    const options = getDatabaseConnectionOptions(
      "postgresql://feedy:feedy@localhost:5433/feedy?sslmode=disable",
      {
        DATABASE_POOL_SIZE: "4",
        DATABASE_IDLE_TIMEOUT_SECONDS: "30",
        DATABASE_CONNECT_TIMEOUT_SECONDS: "15",
        DATABASE_MAX_LIFETIME_SECONDS: "45",
      },
    );

    expect(options).toMatchObject({
      max: 4,
      idle_timeout: 30,
      connect_timeout: 15,
      max_lifetime: 45,
      connection: {
        application_name: "feedy",
        search_path: "public",
      },
    });
    expect(() =>
      getDatabaseConnectionOptions(
        "postgresql://feedy:feedy@localhost:5433/feedy?sslmode=disable",
        { DATABASE_POOL_SIZE: "0" },
      ),
    ).toThrow(/DATABASE_POOL_SIZE must be a positive integer/);
    expect(() =>
      getDatabaseConnectionOptions(
        "postgresql://feedy:feedy@localhost:5433/feedy?sslmode=disable",
        { DATABASE_MAX_LIFETIME_SECONDS: "0" },
      ),
    ).toThrow(/DATABASE_MAX_LIFETIME_SECONDS must be a positive integer/);
  });

  it("isolates deployments in a validated PostgreSQL schema", () => {
    expect(getDatabaseSchema({})).toBe("public");
    expect(getDatabaseSchema({ DATABASE_SCHEMA: "feedy" })).toBe("feedy");
    expect(
      getDatabaseConnectionOptions(
        "postgresql://feedy:feedy@localhost:5433/feedy?sslmode=disable",
        { DATABASE_SCHEMA: "feedy" },
      ).connection,
    ).toMatchObject({ search_path: "feedy,public" });
    expect(() => getDatabaseSchema({ DATABASE_SCHEMA: "Feedy;drop" })).toThrow(
      /DATABASE_SCHEMA/,
    );
  });
});
