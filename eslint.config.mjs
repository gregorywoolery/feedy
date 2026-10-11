import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["src/features/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/server/**",
                "@/use-cases/**",
                "@/data-access/**",
                "@/lib/database/**",
                "@/lib/storage/**",
                "@/lib/validation/photos",
                "@/lib/export/pdf",
                "**/server/**",
                "**/use-cases/**",
                "**/data-access/**",
                "**/lib/database/**",
                "**/lib/storage/**",
              ],
              message:
                "UI uses browser-safe contracts and HTTP clients. Server implementations belong in src/server.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/data-access/**",
                "@/lib/database/**",
                "@/lib/storage/**",
                "@/lib/export/pdf",
                "**/data-access/**",
                "**/lib/database/**",
                "**/lib/storage/**",
              ],
              message:
                "Routes and pages call the application composition module.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/use-cases/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "zod",
                "@/lib/validation/feedback",
                "@/lib/validation/projects",
                "**/lib/validation/feedback",
                "**/lib/validation/projects",
              ],
              allowTypeImports: true,
              message:
                "Validate request shapes in route handlers. Use cases receive typed inputs and enforce business rules.",
            },
            {
              group: [
                "@/server/**",
                "@/data-access/**",
                "@/lib/database/**",
                "@/lib/storage/**",
                "@/lib/validation/photos",
                "@/lib/export/pdf",
                "next/**",
                "sharp",
                "postgres",
                "drizzle-orm",
                "drizzle-orm/**",
                "node:*",
                "**/data-access/**",
                "**/lib/database/**",
                "**/lib/storage/**",
              ],
              message:
                "Use cases receive infrastructure through explicit application ports.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/entities/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/**",
                "@/server/**",
                "@/app/**",
                "@/features/**",
                "@/data-access/**",
                "@/use-cases/**",
                "next/**",
                "node:*",
                "**/lib/**",
                "**/server/**",
                "**/data-access/**",
              ],
              message:
                "Domain types and contracts must stay independent of infrastructure and UI.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);
