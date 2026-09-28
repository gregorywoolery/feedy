import { and, eq } from "drizzle-orm";

import { db } from "@/lib/database/client";
import { feedbackPhotos, photoCleanupJobs } from "@/lib/database/schema";
import type { PhotoStorage } from "@/entities/photo-storage";

/** Pending rows survive process restarts. Never remove bytes still referenced by metadata. */
export async function cleanupPhotos(
  storage: PhotoStorage,
  keys: string[],
): Promise<number> {
  if (!keys.length) return 0;
  const uniqueKeys = [...new Set(keys)];
  await db
    .insert(photoCleanupJobs)
    .values(
      uniqueKeys.map((storageKey) => ({
        storageKey,
        storageNamespace: storage.namespace,
      })),
    )
    .onConflictDoNothing();

  let pending = 0;
  for (const key of uniqueKeys) {
    try {
      const [referenced] = await db
        .select({ id: feedbackPhotos.id })
        .from(feedbackPhotos)
        .where(eq(feedbackPhotos.storageKey, key))
        .limit(1);
      if (!referenced) await storage.delete(key);
      await db
        .delete(photoCleanupJobs)
        .where(
          and(
            eq(photoCleanupJobs.storageKey, key),
            eq(photoCleanupJobs.storageNamespace, storage.namespace),
          ),
        );
    } catch (error) {
      pending += 1;
      console.error("Photo cleanup will be retried.", error);
    }
  }
  return pending;
}

export async function retryPhotoCleanup(storage: PhotoStorage) {
  const jobs = await db
    .select({ key: photoCleanupJobs.storageKey })
    .from(photoCleanupJobs)
    .where(eq(photoCleanupJobs.storageNamespace, storage.namespace))
    .limit(1000);
  return cleanupPhotos(
    storage,
    jobs.map((job) => job.key),
  );
}
