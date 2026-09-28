import type { ApplicationDependencies } from "@/use-cases/ports";

export async function getPhotoUseCase(
  photoId: string,
  dependencies: ApplicationDependencies,
) {
  const record = await dependencies.feedback.getPhotoStorageRecord(photoId);
  if (!record) return null;
  const stored = await dependencies.storage.get(record.storageKey);
  return {
    ...record,
    bytes: stored.bytes,
    mimeType: record.mimeType,
  };
}
