import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { eq, isNull, lt, and } from "drizzle-orm";
import { db } from "@/lib/database/client";
import { feedbackPhotos, photoObjects } from "@/lib/database/schema";
import { LocalPhotoStorage } from "./local";
import { DatabasePhotoStorage } from "./database";
import type { PhotoStorage } from "@/entities/photo-storage";
import { STORAGE_KEY_PATTERN } from "./shared";

/** A conservative grace period keeps active uploads out of maintenance. */
export async function findOrphanPhotoKeys(
  storage: PhotoStorage,
  olderThan = new Date(Date.now() - 24 * 60 * 60 * 1000),
) {
  if (storage instanceof DatabasePhotoStorage) {
    const rows = await db
      .select({ key: photoObjects.key })
      .from(photoObjects)
      .leftJoin(feedbackPhotos, eq(feedbackPhotos.storageKey, photoObjects.key))
      .where(
        and(isNull(feedbackPhotos.id), lt(photoObjects.createdAt, olderThan)),
      )
      .limit(1000);
    return rows.map((row) => row.key);
  }
  if (!(storage instanceof LocalPhotoStorage))
    throw new Error("This storage adapter does not support reconciliation.");
  let names: string[];
  try {
    names = await readdir(storage.uploadDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const orphans: string[] = [];
  for (const key of names) {
    if (!STORAGE_KEY_PATTERN.test(key)) continue;
    const stat = await lstat(path.join(storage.uploadDir, key));
    if (!stat.isFile() || stat.isSymbolicLink() || stat.mtime >= olderThan)
      continue;
    const [referenced] = await db
      .select({ id: feedbackPhotos.id })
      .from(feedbackPhotos)
      .where(eq(feedbackPhotos.storageKey, key))
      .limit(1);
    if (!referenced) orphans.push(key);
    if (orphans.length === 1000) break;
  }
  return orphans;
}
