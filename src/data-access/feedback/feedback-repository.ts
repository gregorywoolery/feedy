import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  or,
  sql,
  type SQL
} from "drizzle-orm";

import type {
  FeedbackDetailRecord,
  FeedbackListItem,
  FeedbackPage,
  FeedbackPhotoRecord,
  FeedbackQuery,
  FeedbackSummary
} from "@/entities/contracts/feedback";
import { db } from "@/lib/database/client";
import { feedbackItems, feedbackPhotos, projects } from "@/lib/database/schema";
import type { ValidatedPhoto } from "@/lib/validation/photos";

export interface StoredPhotoInput extends ValidatedPhoto {
  storageKey: string;
  sortOrder: number;
}

function photoUrl(id: string) {
  return `/api/photos/${id}`;
}

function serializePhoto(photo: {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  sortOrder: number;
}): FeedbackPhotoRecord {
  return {
    ...photo,
    mimeType: photo.mimeType as FeedbackPhotoRecord["mimeType"],
    url: photoUrl(photo.id)
  };
}

function startOfUtcDay(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function nextUtcDay(value: string) {
  const date = startOfUtcDay(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function buildConditions(query: FeedbackQuery) {
  const conditions: SQL[] = [];
  if (query.q) {
    const pattern = `%${query.q.replace(/[%_]/g, "\\$&")}%`;
    const search = or(
      ilike(projects.name, pattern),
      ilike(feedbackItems.projectVersion, pattern),
      ilike(feedbackItems.description, pattern)
    );
    if (search) conditions.push(search);
  }
  if (query.project) conditions.push(eq(feedbackItems.projectId, query.project));
  if (query.version) conditions.push(eq(feedbackItems.projectVersion, query.version));
  if (query.from) conditions.push(gte(feedbackItems.createdAt, startOfUtcDay(query.from)));
  if (query.to) conditions.push(lt(feedbackItems.createdAt, nextUtcDay(query.to)));
  if (query.hasPhotos === "yes") {
    conditions.push(
      sql`exists (select 1 from ${feedbackPhotos} fp where fp.feedback_id = ${feedbackItems.id})`
    );
  }
  if (query.hasPhotos === "no") {
    conditions.push(
      sql`not exists (select 1 from ${feedbackPhotos} fp where fp.feedback_id = ${feedbackItems.id})`
    );
  }
  return conditions.length ? and(...conditions) : undefined;
}

function sortColumn(query: FeedbackQuery) {
  if (query.sort === "updatedAt") return feedbackItems.updatedAt;
  if (query.sort === "project") return projects.name;
  if (query.sort === "version") return feedbackItems.projectVersion;
  return feedbackItems.createdAt;
}

async function photosForFeedbackIds(ids: string[]) {
  if (!ids.length) return new Map<string, FeedbackPhotoRecord[]>();
  const rows = await db
    .select({
      id: feedbackPhotos.id,
      feedbackId: feedbackPhotos.feedbackId,
      originalFilename: feedbackPhotos.originalFilename,
      mimeType: feedbackPhotos.mimeType,
      sizeBytes: feedbackPhotos.sizeBytes,
      width: feedbackPhotos.width,
      height: feedbackPhotos.height,
      sortOrder: feedbackPhotos.sortOrder
    })
    .from(feedbackPhotos)
    .where(inArray(feedbackPhotos.feedbackId, ids))
    .orderBy(feedbackPhotos.feedbackId, feedbackPhotos.sortOrder);

  const byFeedback = new Map<string, FeedbackPhotoRecord[]>();
  for (const row of rows) {
    const list = byFeedback.get(row.feedbackId) ?? [];
    list.push(serializePhoto(row));
    byFeedback.set(row.feedbackId, list);
  }
  return byFeedback;
}

export async function listFeedback(query: FeedbackQuery): Promise<FeedbackPage> {
  const where = buildConditions(query);
  const [{ total }] = await db
    .select({ total: count() })
    .from(feedbackItems)
    .innerJoin(projects, eq(feedbackItems.projectId, projects.id))
    .where(where);

  const pageCount = Math.max(1, Math.ceil(Number(total) / query.pageSize));
  const page = Math.min(query.page, pageCount);
  const primarySort = query.order === "asc" ? asc(sortColumn(query)) : desc(sortColumn(query));
  const tieBreak = query.order === "asc" ? asc(feedbackItems.id) : desc(feedbackItems.id);

  const rows = await db
    .select({
      id: feedbackItems.id,
      projectId: feedbackItems.projectId,
      projectName: projects.name,
      projectVersion: feedbackItems.projectVersion,
      description: feedbackItems.description,
      createdAt: feedbackItems.createdAt,
      updatedAt: feedbackItems.updatedAt
    })
    .from(feedbackItems)
    .innerJoin(projects, eq(feedbackItems.projectId, projects.id))
    .where(where)
    .orderBy(primarySort, tieBreak)
    .limit(query.pageSize)
    .offset((page - 1) * query.pageSize);

  const photoMap = await photosForFeedbackIds(rows.map((row) => row.id));
  const items: FeedbackListItem[] = rows.map((row) => {
    const photos = photoMap.get(row.id) ?? [];
    return {
      ...row,
      photos,
      photoCount: photos.length,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  });

  return { items, total: Number(total), page, pageSize: query.pageSize, pageCount };
}

export async function listFeedbackIds(
  query: FeedbackQuery,
  maximum: number
): Promise<{ ids: string[]; exceedsMaximum: boolean }> {
  const where = buildConditions(query);
  const primarySort = query.order === "asc" ? asc(sortColumn(query)) : desc(sortColumn(query));
  const tieBreak = query.order === "asc" ? asc(feedbackItems.id) : desc(feedbackItems.id);
  const rows = await db
    .select({ id: feedbackItems.id })
    .from(feedbackItems)
    .innerJoin(projects, eq(feedbackItems.projectId, projects.id))
    .where(where)
    .orderBy(primarySort, tieBreak)
    .limit(maximum + 1);

  return {
    ids: rows.slice(0, maximum).map((row) => row.id),
    exceedsMaximum: rows.length > maximum
  };
}

export async function getFeedbackSummary(): Promise<FeedbackSummary> {
  const [[row], [projectRow]] = await Promise.all([
    db
      .select({
        feedbackCount: countDistinct(feedbackItems.id),
        withPhotosCount: countDistinct(feedbackPhotos.feedbackId)
      })
      .from(feedbackItems)
      .leftJoin(feedbackPhotos, eq(feedbackPhotos.feedbackId, feedbackItems.id)),
    db.select({ projectCount: count(projects.id) }).from(projects)
  ]);
  return {
    feedbackCount: Number(row.feedbackCount),
    projectCount: Number(projectRow.projectCount),
    withPhotosCount: Number(row.withPhotosCount)
  };
}

export async function listFeedbackVersions(projectId?: string) {
  const rows = await db
    .selectDistinct({ version: feedbackItems.projectVersion })
    .from(feedbackItems)
    .where(projectId ? eq(feedbackItems.projectId, projectId) : undefined)
    .orderBy(feedbackItems.projectVersion);
  return rows.map((row) => row.version);
}

export async function getFeedbackById(feedbackId: string): Promise<FeedbackDetailRecord | null> {
  const [row] = await db
    .select({
      id: feedbackItems.id,
      projectId: feedbackItems.projectId,
      projectName: projects.name,
      projectVersion: feedbackItems.projectVersion,
      description: feedbackItems.description,
      createdAt: feedbackItems.createdAt,
      updatedAt: feedbackItems.updatedAt
    })
    .from(feedbackItems)
    .innerJoin(projects, eq(feedbackItems.projectId, projects.id))
    .where(eq(feedbackItems.id, feedbackId))
    .limit(1);
  if (!row) return null;
  const photoMap = await photosForFeedbackIds([feedbackId]);
  const photos = photoMap.get(feedbackId) ?? [];
  return {
    ...row,
    photos,
    photoCount: photos.length,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function getFeedbackBatch(ids: string[]) {
  const rows = await db
    .select({
      id: feedbackItems.id,
      projectId: feedbackItems.projectId,
      projectName: projects.name,
      projectVersion: feedbackItems.projectVersion,
      description: feedbackItems.description,
      createdAt: feedbackItems.createdAt,
      updatedAt: feedbackItems.updatedAt
    })
    .from(feedbackItems)
    .innerJoin(projects, eq(feedbackItems.projectId, projects.id))
    .where(inArray(feedbackItems.id, ids));
  const photoMap = await photosForFeedbackIds(ids);
  const byId = new Map(
    rows.map((row) => {
      const photos = photoMap.get(row.id) ?? [];
      return [
        row.id,
        {
          ...row,
          photos,
          photoCount: photos.length,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString()
        } satisfies FeedbackDetailRecord
      ];
    })
  );
  return ids.map((id) => byId.get(id)).filter(Boolean) as FeedbackDetailRecord[];
}

export async function createFeedbackRecord(input: {
  projectId: string;
  projectVersion: string;
  description: string;
  photos: StoredPhotoInput[];
}) {
  return db.transaction(async (transaction) => {
    const [feedback] = await transaction
      .insert(feedbackItems)
      .values({
        projectId: input.projectId,
        projectVersion: input.projectVersion,
        description: input.description
      })
      .returning();

    if (input.photos.length) {
      await transaction.insert(feedbackPhotos).values(
        input.photos.map((photo) => ({
          feedbackId: feedback.id,
          storageKey: photo.storageKey,
          originalFilename: photo.originalFilename,
          mimeType: photo.mimeType,
          sizeBytes: photo.sizeBytes,
          width: photo.width,
          height: photo.height,
          sortOrder: photo.sortOrder
        }))
      );
    }
    return feedback.id;
  });
}

export class FeedbackPhotoStateError extends Error {}

export async function updateFeedbackRecord(input: {
  feedbackId: string;
  projectVersion: string;
  description: string;
  retainedPhotos: Array<{ id: string; sortOrder: number }>;
  newPhotos: StoredPhotoInput[];
}) {
  return db.transaction(async (transaction) => {
    const current = await transaction.select({ id: feedbackPhotos.id, storageKey: feedbackPhotos.storageKey })
      .from(feedbackPhotos).where(eq(feedbackPhotos.feedbackId, input.feedbackId));
    const currentIds = new Set(current.map((photo) => photo.id));
    if (input.retainedPhotos.some((photo) => !currentIds.has(photo.id))) {
      throw new FeedbackPhotoStateError("The attached photos changed. Refresh and try again.");
    }
    const [updated] = await transaction.update(feedbackItems).set({
      projectVersion: input.projectVersion,
      description: input.description,
      updatedAt: new Date()
    }).where(eq(feedbackItems.id, input.feedbackId)).returning({ id: feedbackItems.id });
    if (!updated) return null;

    if (current.length) {
      await transaction.update(feedbackPhotos)
        .set({ sortOrder: sql`${feedbackPhotos.sortOrder} + 1000` })
        .where(eq(feedbackPhotos.feedbackId, input.feedbackId));
    }
    const retainedIds = new Set(input.retainedPhotos.map((photo) => photo.id));
    const removed = current.filter((photo) => !retainedIds.has(photo.id));
    if (removed.length) await transaction.delete(feedbackPhotos).where(inArray(feedbackPhotos.id, removed.map((photo) => photo.id)));
    for (const photo of input.retainedPhotos) {
      await transaction.update(feedbackPhotos).set({ sortOrder: photo.sortOrder })
        .where(and(eq(feedbackPhotos.id, photo.id), eq(feedbackPhotos.feedbackId, input.feedbackId)));
    }
    if (input.newPhotos.length) {
      await transaction.insert(feedbackPhotos).values(input.newPhotos.map((photo) => ({
        feedbackId: input.feedbackId, storageKey: photo.storageKey, originalFilename: photo.originalFilename,
        mimeType: photo.mimeType, sizeBytes: photo.sizeBytes, width: photo.width, height: photo.height,
        sortOrder: photo.sortOrder
      })));
    }
    return { removedStorageKeys: removed.map((photo) => photo.storageKey) };
  });
}

export async function getPhotoStorageRecord(photoId: string) {
  const [photo] = await db
    .select({
      id: feedbackPhotos.id,
      storageKey: feedbackPhotos.storageKey,
      mimeType: feedbackPhotos.mimeType,
      originalFilename: feedbackPhotos.originalFilename
    })
    .from(feedbackPhotos)
    .where(eq(feedbackPhotos.id, photoId))
    .limit(1);
  return photo ?? null;
}

export async function listPhotoStorageRecords(feedbackIds: string[]) {
  if (!feedbackIds.length) return [];
  return db
    .select({
      id: feedbackPhotos.id,
      feedbackId: feedbackPhotos.feedbackId,
      storageKey: feedbackPhotos.storageKey,
      originalFilename: feedbackPhotos.originalFilename,
      mimeType: feedbackPhotos.mimeType,
      sizeBytes: feedbackPhotos.sizeBytes,
      width: feedbackPhotos.width,
      height: feedbackPhotos.height,
      sortOrder: feedbackPhotos.sortOrder
    })
    .from(feedbackPhotos)
    .where(inArray(feedbackPhotos.feedbackId, feedbackIds))
    .orderBy(feedbackPhotos.feedbackId, feedbackPhotos.sortOrder);
}

export async function deleteFeedbackRecords(feedbackIds: string[]) {
  return db.transaction(async (transaction) => {
    const photos = await transaction
      .select({ storageKey: feedbackPhotos.storageKey })
      .from(feedbackPhotos)
      .where(inArray(feedbackPhotos.feedbackId, feedbackIds));

    const deleted = await transaction
      .delete(feedbackItems)
      .where(inArray(feedbackItems.id, feedbackIds))
      .returning({ id: feedbackItems.id });

    return {
      deletedIds: deleted.map((item) => item.id),
      storageKeys: photos.map((photo) => photo.storageKey)
    };
  });
}
