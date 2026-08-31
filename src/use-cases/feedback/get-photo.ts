import { getPhotoStorageRecord } from "@/data-access/feedback/feedback-repository";
import { getPhotoStorage } from "@/lib/storage";

export async function getPhotoUseCase(photoId: string) {
  const record = await getPhotoStorageRecord(photoId);
  if (!record) return null;
  const stored = await getPhotoStorage().get(record.storageKey);
  return {
    ...record,
    bytes: stored.bytes,
    mimeType: record.mimeType
  };
}
