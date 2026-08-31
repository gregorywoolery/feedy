import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { loadEnvConfig } from "@next/env";
import postgres from "postgres";

import {
  getDatabaseConnectionOptions,
  getDatabaseUrl,
} from "../src/lib/database/config";
import {
  feedbackItems,
  projects,
  type NewFeedbackItem,
  type NewProject,
} from "../src/lib/database/schema";

const projectSeeds: NewProject[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Customer portal",
    description: "Product review notes for the customer-facing portal.",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Marketing site",
    description: "Feedback collected during website release reviews.",
  },
];

const feedbackSeeds: NewFeedbackItem[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    projectId: projectSeeds[0].id as string,
    projectVersion: "1.4.0",
    description:
      "The mobile navigation overlaps the page title at the tablet breakpoint.",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    projectId: projectSeeds[0].id as string,
    projectVersion: "build-218",
    description:
      "Keep the account summary visible while the transaction list loads.",
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    projectId: projectSeeds[1].id as string,
    projectVersion: "homepage-redesign-v2",
    description:
      "The primary call to action needs more separation from the supporting copy.",
  },
];

async function main() {
  loadEnvConfig(process.cwd());
  const databaseUrl = getDatabaseUrl();
  const sqlClient = postgres(databaseUrl, {
    ...getDatabaseConnectionOptions(databaseUrl),
    max: 1,
  });
  const db = drizzle(sqlClient);

  try {
    await db.transaction(async (transaction) => {
      for (const project of projectSeeds) {
        await transaction
          .insert(projects)
          .values(project)
          .onConflictDoUpdate({
            target: projects.id,
            set: {
              name: project.name,
              description: project.description,
              updatedAt: sql`now()`,
            },
          });
      }

      for (const feedback of feedbackSeeds) {
        await transaction
          .insert(feedbackItems)
          .values(feedback)
          .onConflictDoUpdate({
            target: feedbackItems.id,
            set: {
              projectId: feedback.projectId,
              projectVersion: feedback.projectVersion,
              description: feedback.description,
              updatedAt: sql`now()`,
            },
          });
      }
    });

    console.log(
      `Seeded ${projectSeeds.length} projects and ${feedbackSeeds.length} feedback items.`,
    );
  } finally {
    await sqlClient.end();
  }
}

main().catch((error: unknown) => {
  console.error("Database seed failed.", error);
  process.exitCode = 1;
});
