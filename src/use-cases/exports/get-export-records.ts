import {
  getFeedbackBatch,
  listPhotoStorageRecords
} from "@/data-access/feedback/feedback-repository";
import type { FeedbackExportRecord } from "@/entities/contracts/feedback";
import { getPhotoStorage } from "@/lib/storage";

export class FeedbackExportNotFoundError extends Error {
  constructor() {
    super("One or more selected feedback records could not be found.");
    this.name = "FeedbackExportNotFoundError";
  }
}

export async function getExportRecords(ids: string[]): Promise<FeedbackExportRecord[]> {
  const details = await getFeedbackBatch(ids);
  if (details.length !== ids.length) throw new FeedbackExportNotFoundError();

  const storedPhotos = await listPhotoStorageRecords(ids);
  const storageRowsByFeedback = new Map<string, typeof storedPhotos>();
  for (const photo of storedPhotos) {
    const list = storageRowsByFeedback.get(photo.feedbackId) ?? [];
    list.push(photo);
    storageRowsByFeedback.set(photo.feedbackId, list);
  }

  const storage = getPhotoStorage();
  const records: FeedbackExportRecord[] = [];
  for (const detail of details) {
    const storageRows = storageRowsByFeedback.get(detail.id) ?? [];
    const photoById = new Map(detail.photos.map((photo) => [photo.id, photo]));
    const photoBytes: FeedbackExportRecord["photoBytes"] = [];
    for (const row of storageRows) {
      const metadata = photoById.get(row.id);
      if (!metadata) continue;
      const stored = await storage.get(row.storageKey);
      photoBytes.push({ ...metadata, bytes: stored.bytes });
    }
    records.push({ ...detail, photoBytes });
  }
  return records;
}
