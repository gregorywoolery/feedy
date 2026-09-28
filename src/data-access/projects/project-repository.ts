import { count, desc, eq, max, sql } from "drizzle-orm";

import type {
  ProjectOption,
  ProjectRecord,
} from "@/entities/contracts/project";
import type { CreateProjectInput } from "@/lib/validation/projects";
import { db } from "@/lib/database/client";
import {
  feedbackItems,
  feedbackPhotos,
  photoCleanupJobs,
  projects,
} from "@/lib/database/schema";

function serializeProject(row: {
  id: string;
  name: string;
  description: string | null;
  feedbackCount: number;
  lastActivityAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ProjectRecord {
  return {
    ...row,
    feedbackCount: Number(row.feedbackCount),
    lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const activity = max(feedbackItems.createdAt);
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      feedbackCount: count(feedbackItems.id),
      lastActivityAt: activity,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .leftJoin(feedbackItems, eq(feedbackItems.projectId, projects.id))
    .groupBy(projects.id)
    .orderBy(
      desc(sql`coalesce(${activity}, ${projects.updatedAt})`),
      projects.name,
    );

  return rows.map(serializeProject);
}

export async function listProjectOptions(): Promise<ProjectOption[]> {
  return db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .orderBy(projects.name);
}

export async function getProjectById(projectId: string) {
  const activity = max(feedbackItems.createdAt);
  const [row] = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      feedbackCount: count(feedbackItems.id),
      lastActivityAt: activity,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .leftJoin(feedbackItems, eq(feedbackItems.projectId, projects.id))
    .where(eq(projects.id, projectId))
    .groupBy(projects.id)
    .limit(1);

  return row ? serializeProject(row) : null;
}

export async function createProject(input: CreateProjectInput) {
  const [project] = await db
    .insert(projects)
    .values({ name: input.name, description: input.description })
    .returning();

  return serializeProject({
    ...project,
    feedbackCount: 0,
    lastActivityAt: null,
  });
}

export async function projectExists(projectId: string) {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return Boolean(project);
}

export async function deleteProjectRecord(
  projectId: string,
  storageNamespace: string,
) {
  return db.transaction(async (transaction) => {
    await transaction
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .for("update");
    await transaction
      .select({ id: feedbackItems.id })
      .from(feedbackItems)
      .where(eq(feedbackItems.projectId, projectId))
      .orderBy(feedbackItems.id)
      .for("update");
    const photos = await transaction
      .select({ storageKey: feedbackPhotos.storageKey })
      .from(feedbackPhotos)
      .innerJoin(feedbackItems, eq(feedbackPhotos.feedbackId, feedbackItems.id))
      .where(eq(feedbackItems.projectId, projectId));

    if (photos.length) {
      await transaction
        .insert(photoCleanupJobs)
        .values(
          photos.map((photo) => ({
            storageKey: photo.storageKey,
            storageNamespace,
          })),
        )
        .onConflictDoNothing();
    }
    const deletedFeedback = await transaction
      .delete(feedbackItems)
      .where(eq(feedbackItems.projectId, projectId))
      .returning({ id: feedbackItems.id });

    const [deletedProject] = await transaction
      .delete(projects)
      .where(eq(projects.id, projectId))
      .returning({ id: projects.id });

    return {
      deleted: Boolean(deletedProject),
      feedbackCount: deletedFeedback.length,
      storageKeys: photos.map((photo) => photo.storageKey),
    };
  });
}
