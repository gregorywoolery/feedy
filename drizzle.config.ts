import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

import { getDatabaseUrl } from "./src/lib/database/config";

loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "./src/lib/database/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: getDatabaseUrl(),
  },
  strict: true,
  verbose: true,
});
