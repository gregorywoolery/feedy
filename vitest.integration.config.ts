import path from "node:path";
import { defineConfig } from "vitest/config";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl)
  throw new Error("Set TEST_DATABASE_URL to a disposable local database.");
const parsed = new URL(databaseUrl);
if (!["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)) {
  throw new Error("Integration tests only accept a local test database.");
}
process.env.DATABASE_URL = databaseUrl;
process.env.DATABASE_SCHEMA = "public";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
  },
});
