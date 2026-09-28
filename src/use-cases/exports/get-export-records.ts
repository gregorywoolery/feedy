import { presentFeedback } from "@/use-cases/present-feedback";
import {
  ExportLimitError,
  MAX_EXPORT_BYTES,
  MAX_EXPORT_PHOTOS,
} from "./export-limits";
import type { ApplicationDependencies } from "@/use-cases/ports";
import type { FeedbackExportRecord } from "@/entities/contracts/feedback";

export class FeedbackExportNotFoundError extends Error {
  constructor() {
    super("One or more selected feedback records could not be found.");
    this.name = "FeedbackExportNotFoundError";
  }
}

export async function getExportRecords(
  ids: string[],
  dependencies: ApplicationDependencies,
): Promise<FeedbackExportRecord[]> {
  const details = (await dependencies.feedback.getFeedbackBatch(ids)).map(
    presentFeedback,
  );
  if (details.length !== ids.length) throw new FeedbackExportNotFoundError();

  const storedPhotos = await dependencies.feedback.listPhotoStorageRecords(ids);
  const totalBytes = storedPhotos.reduce(
    (sum, photo) => sum + photo.sizeBytes,
    0,
  );
  if (
    storedPhotos.length > MAX_EXPORT_PHOTOS ||
    totalBytes > MAX_EXPORT_BYTES
  ) {
    throw new ExportLimitError(
      "Export up to 100 photos and 50 MB of photo data at a time. Narrow your selection.",
    );
  }
  let loadedBytes = 0;
  const storageRowsByFeedback = new Map<string, typeof storedPhotos>();
  for (const photo of storedPhotos) {
    const list = storageRowsByFeedback.get(photo.feedbackId) ?? [];
    list.push(photo);
    storageRowsByFeedback.set(photo.feedbackId, list);
  }

  const storage = dependencies.storage;
  const records: FeedbackExportRecord[] = [];
  for (const detail of details) {
    const storageRows = storageRowsByFeedback.get(detail.id) ?? [];
    const photoById = new Map(detail.photos.map((photo) => [photo.id, photo]));
    const photoBytes: FeedbackExportRecord["photoBytes"] = [];
    for (const row of storageRows) {
      const metadata = photoById.get(row.id);
      if (!metadata) continue;
      const stored = await storage.get(row.storageKey);
      loadedBytes += stored.bytes.byteLength;
      if (loadedBytes > MAX_EXPORT_BYTES) {
        throw new ExportLimitError(
          "The selected photos exceed the 50 MB export limit.",
        );
      }
      photoBytes.push({ ...metadata, bytes: stored.bytes });
    }
    records.push({ ...detail, photoBytes });
  }
  return records;
}
