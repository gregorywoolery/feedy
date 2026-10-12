import type postgres from "postgres";

export type DatabaseEnvironment = Readonly<Record<string, string | undefined>>;

export type DatabaseConnectionOptions = Pick<
  postgres.Options<Record<string, postgres.PostgresType>>,
  | "connect_timeout"
  | "connection"
  | "idle_timeout"
  | "max"
  | "max_lifetime"
  | "prepare"
  | "ssl"
>;

const DATABASE_SCHEMA_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

const TEST_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable";

const DIRECT_DATABASE_URL_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "SUPABASE_DB_URL",
] as const;

function readNonEmpty(
  environment: DatabaseEnvironment,
  name: string,
): string | undefined {
  const value = environment[name]?.trim();
  return value ? value : undefined;
}

function validateDatabaseUrl(candidate: string, source: string): string {
  let url: URL;

  try {
    url = new URL(candidate);
  } catch {
    throw new Error(`${source} must be a valid PostgreSQL connection URL.`);
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error(
      `${source} must use the postgresql:// or postgres:// protocol.`,
    );
  }

  if (!url.hostname) {
    throw new Error(`${source} must include a database hostname.`);
  }

  if (!url.pathname || url.pathname === "/") {
    throw new Error(`${source} must include a database name.`);
  }

  const hostname = url.hostname.toLowerCase();
  const isSupabaseConnection =
    source === "SUPABASE_DB_URL" ||
    hostname.endsWith(".supabase.co") ||
    hostname.endsWith(".supabase.com");
  const sslMode = url.searchParams.get("sslmode")?.toLowerCase();

  if (
    isSupabaseConnection &&
    sslMode !== "require" &&
    sslMode !== "verify-full"
  ) {
    throw new Error(
      `${source} points to Supabase and must include sslmode=verify-full (sslmode=require is upgraded to verified TLS).`,
    );
  }

  // Older URLs remain compatible, but never disable certificate verification.
  if (sslMode === "require" || sslMode === "allow" || sslMode === "prefer") {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}

function readPort(value: string | undefined): number {
  if (!value) {
    return 5432;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error("SUPABASE_DB_PORT must be an integer between 1 and 65535.");
  }

  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("SUPABASE_DB_PORT must be an integer between 1 and 65535.");
  }

  return port;
}

function buildSplitSupabaseUrl(
  environment: DatabaseEnvironment,
): string | null {
  const names = [
    "SUPABASE_DB_HOST",
    "SUPABASE_DB_NAME",
    "SUPABASE_DB_USER",
    "SUPABASE_DB_PASSWORD",
  ] as const;
  const values: Record<(typeof names)[number], string | undefined> = {
    SUPABASE_DB_HOST: readNonEmpty(environment, "SUPABASE_DB_HOST"),
    SUPABASE_DB_NAME: readNonEmpty(environment, "SUPABASE_DB_NAME"),
    SUPABASE_DB_USER: readNonEmpty(environment, "SUPABASE_DB_USER"),
    // Preserve intentional leading or trailing password characters while still
    // treating a whitespace-only value as missing.
    SUPABASE_DB_PASSWORD: environment.SUPABASE_DB_PASSWORD?.trim()
      ? environment.SUPABASE_DB_PASSWORD
      : undefined,
  };
  const configuredNames = names.filter((name) => values[name] !== undefined);
  const configuredPort = readNonEmpty(environment, "SUPABASE_DB_PORT");

  if (configuredNames.length === 0 && !configuredPort) {
    return null;
  }

  const missingNames = names.filter((name) => values[name] === undefined);
  if (missingNames.length > 0) {
    throw new Error(
      `Incomplete split Supabase database configuration. Missing: ${missingNames.join(
        ", ",
      )}.`,
    );
  }

  const port = readPort(configuredPort);
  const host = values.SUPABASE_DB_HOST as string;
  const name = values.SUPABASE_DB_NAME as string;
  const user = values.SUPABASE_DB_USER as string;
  const password = values.SUPABASE_DB_PASSWORD as string;
  const url = new URL("postgresql://placeholder");

  url.username = user;
  url.password = password;
  url.hostname = host;
  url.port = String(port);
  url.pathname = `/${name}`;
  url.searchParams.set("sslmode", "verify-full");

  return url.toString();
}

/**
 * Resolves the one canonical PostgreSQL URL used by the application and tools.
 * Direct connection strings take precedence over split Supabase credentials.
 */
export function getDatabaseUrl(
  environment: DatabaseEnvironment = process.env,
): string {
  for (const key of DIRECT_DATABASE_URL_KEYS) {
    const value = readNonEmpty(environment, key);
    if (value) {
      return validateDatabaseUrl(value, key);
    }
  }

  const splitSupabaseUrl = buildSplitSupabaseUrl(environment);
  if (splitSupabaseUrl) {
    return validateDatabaseUrl(
      splitSupabaseUrl,
      "split Supabase configuration",
    );
  }

  if (environment.NODE_ENV === "test") {
    return TEST_DATABASE_URL;
  }

  throw new Error(
    "Database configuration is missing. Set DATABASE_URL, POSTGRES_URL, " +
      "SUPABASE_DB_URL, or all SUPABASE_DB_* values.",
  );
}

export function getDatabaseSchema(
  environment: DatabaseEnvironment = process.env,
): string {
  const schema = readNonEmpty(environment, "DATABASE_SCHEMA") || "public";
  if (!DATABASE_SCHEMA_PATTERN.test(schema)) {
    throw new Error(
      "DATABASE_SCHEMA must start with a lowercase letter and contain only lowercase letters, numbers, or underscores.",
    );
  }
  return schema;
}

function readPositiveInteger(
  environment: DatabaseEnvironment,
  name: string,
  fallback: number,
): number {
  const rawValue = readNonEmpty(environment, name);
  if (!rawValue) {
    return fallback;
  }

  if (!/^\d+$/.test(rawValue)) {
    throw new Error(`${name} must be a positive integer.`);
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

function resolveSslMode(databaseUrl: string): DatabaseConnectionOptions["ssl"] {
  const sslMode = new URL(databaseUrl).searchParams
    .get("sslmode")
    ?.toLowerCase();

  switch (sslMode) {
    case undefined:
    case null:
    case "disable":
      return false;
    case "require":
      return "verify-full";
    case "allow":
      return "verify-full";
    case "prefer":
      return "verify-full";
    case "verify-full":
      return "verify-full";
    default:
      throw new Error(
        `Unsupported sslmode "${sslMode}". Use disable, allow, prefer, require, or verify-full.`,
      );
  }
}

/**
 * Produces postgres.js options that work with local PostgreSQL and Supabase's
 * transaction pooler. SSL follows the URL and prepared statements stay off.
 */
export function getDatabaseConnectionOptions(
  databaseUrl = getDatabaseUrl(),
  environment: DatabaseEnvironment = process.env,
): DatabaseConnectionOptions {
  validateDatabaseUrl(databaseUrl, "Database URL");
  const ssl = resolveSslMode(databaseUrl);
  const certificate = readNonEmpty(environment, "DATABASE_CA_CERT");
  if (certificate && !ssl) {
    throw new Error("DATABASE_CA_CERT requires sslmode=verify-full.");
  }

  return {
    max: readPositiveInteger(environment, "DATABASE_POOL_SIZE", 10),
    idle_timeout: readPositiveInteger(
      environment,
      "DATABASE_IDLE_TIMEOUT_SECONDS",
      20,
    ),
    connect_timeout: readPositiveInteger(
      environment,
      "DATABASE_CONNECT_TIMEOUT_SECONDS",
      10,
    ),
    max_lifetime: readPositiveInteger(
      environment,
      "DATABASE_MAX_LIFETIME_SECONDS",
      1_800,
    ),
    prepare: false,
    ssl: certificate
      ? {
          ca: certificate.replaceAll("\\n", "\n"),
          rejectUnauthorized: true,
          host: new URL(databaseUrl).hostname,
        }
      : ssl,
    connection: {
      application_name: "feedy",
      search_path: [getDatabaseSchema(environment), "public"]
        .filter((value, index, values) => values.indexOf(value) === index)
        .join(","),
    },
  };
}
