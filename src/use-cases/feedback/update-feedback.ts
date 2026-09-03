import { z } from "zod";

import { FeedbackPhotoStateError, getFeedbackById, updateFeedbackRecord } from "@/data-access/feedback/feedback-repository";
import { getPhotoStorage } from "@/lib/storage";
import { feedbackIdSchema, updateFeedbackFieldsSchema, updateFeedbackPhotoOrderSchema } from "@/lib/validation/feedback";
import { MAX_TOTAL_PHOTO_BYTES } from "@/lib/validation/photo-limits";
import { PhotoValidationError, validateAndNormalizePhotos } from "@/lib/validation/photos";

export class FeedbackUpdateNotFoundError extends Error {}

export async function updateFeedbackUseCase(input: {
  feedbackId: unknown; projectVersion: unknown; description: unknown; photoOrder: unknown;
  newPhotoIds: unknown[]; newPhotos: File[];
}) {
  const feedbackId = feedbackIdSchema.parse(input.feedbackId);
  const fields = updateFeedbackFieldsSchema.parse(input);
  const order = updateFeedbackPhotoOrderSchema.parse(input.photoOrder);
  const newIds = z.array(z.string().uuid()).parse(input.newPhotoIds);
  if (newIds.length !== input.newPhotos.length || new Set(newIds).size !== newIds.length) {
    throw new PhotoValidationError("The new photo list is invalid. Choose the photos again.");
  }
  const current = await getFeedbackById(feedbackId);
  if (!current) throw new FeedbackUpdateNotFoundError("Feedback was not found.");
  const currentIds = new Set(current.photos.map((photo) => photo.id));
  const orderedExisting = order.filter((item) => item.kind === "existing");
  const orderedNew = order.filter((item) => item.kind === "new");
  if (orderedExisting.some((item) => !currentIds.has(item.id)) || orderedNew.map((item) => item.id).join() !== newIds.join()) {
    throw new PhotoValidationError("The photo order is invalid. Refresh and try again.");
  }

  const normalized = await validateAndNormalizePhotos(input.newPhotos);
  const retainedBytes = current.photos.filter((photo) => orderedExisting.some((item) => item.id === photo.id)).reduce((sum, photo) => sum + photo.sizeBytes, 0);
  if (retainedBytes + normalized.reduce((sum, photo) => sum + photo.sizeBytes, 0) > MAX_TOTAL_PHOTO_BYTES) {
    throw new PhotoValidationError("Photos must be 50 MB or less in total.");
  }
  const storage = getPhotoStorage();
  const stored = [] as Array<(typeof normalized)[number] & { storageKey: string; sortOrder: number }>;
  try {
    for (let index = 0; index < normalized.length; index += 1) {
      const result = await storage.put({ bytes: normalized[index].bytes, mimeType: normalized[index].mimeType });
      const sortOrder = order.findIndex((item) => item.kind === "new" && item.id === newIds[index]);
      stored.push({ ...normalized[index], storageKey: result.key, sortOrder });
    }
    const result = await updateFeedbackRecord({ feedbackId, ...fields, retainedPhotos: orderedExisting.map((photo) => ({ id: photo.id, sortOrder: order.findIndex((item) => item.id === photo.id) })), newPhotos: stored });
    if (!result) throw new FeedbackUpdateNotFoundError("Feedback was not found.");
    await Promise.allSettled(result.removedStorageKeys.map((key) => storage.delete(key)));
    return getFeedbackById(feedbackId);
  } catch (error) {
    await Promise.allSettled(stored.map((photo) => storage.delete(photo.storageKey)));
    if (error instanceof FeedbackPhotoStateError) throw new PhotoValidationError(error.message);
    throw error;
  }
}
