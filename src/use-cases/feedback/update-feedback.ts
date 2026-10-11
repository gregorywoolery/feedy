import { presentFeedback } from "@/use-cases/present-feedback";
import type { ApplicationDependencies } from "@/use-cases/ports";
import type {
  UpdateFeedbackFields,
  UpdateFeedbackPhotoOrder,
} from "@/lib/validation/feedback";
import { MAX_TOTAL_PHOTO_BYTES } from "@/lib/validation/photo-limits";
import {
  PhotoValidationError,
  FeedbackPhotoStateError,
  type StoredPhotoInput,
} from "@/entities/photos";

export class FeedbackUpdateNotFoundError extends Error {}

export interface UpdateFeedbackInput extends UpdateFeedbackFields {
  feedbackId: string;
  photoOrder: UpdateFeedbackPhotoOrder;
  newPhotoIds: string[];
  newPhotos: File[];
}

export async function updateFeedbackUseCase(
  input: UpdateFeedbackInput,
  dependencies: ApplicationDependencies,
) {
  const {
    feedbackId,
    projectVersion,
    description,
    photoOrder: order,
    newPhotoIds: newIds,
  } = input;
  if (
    newIds.length !== input.newPhotos.length ||
    new Set(newIds).size !== newIds.length
  ) {
    throw new PhotoValidationError(
      "The new photo list is invalid. Choose the photos again.",
    );
  }
  const current = await dependencies.feedback.getFeedbackById(feedbackId);
  if (!current)
    throw new FeedbackUpdateNotFoundError("Feedback was not found.");
  const currentIds = new Set(current.photos.map((photo) => photo.id));
  const orderedExisting = order.filter((item) => item.kind === "existing");
  const orderedNew = order.filter((item) => item.kind === "new");
  if (
    orderedExisting.some((item) => !currentIds.has(item.id)) ||
    orderedNew.map((item) => item.id).join() !== newIds.join()
  ) {
    throw new PhotoValidationError(
      "The photo order is invalid. Refresh and try again.",
    );
  }

  const normalized = await dependencies.normalizePhotos(input.newPhotos);
  const retainedBytes = current.photos
    .filter((photo) => orderedExisting.some((item) => item.id === photo.id))
    .reduce((sum, photo) => sum + photo.sizeBytes, 0);
  if (
    retainedBytes +
      normalized.reduce((sum, photo) => sum + photo.sizeBytes, 0) >
    MAX_TOTAL_PHOTO_BYTES
  ) {
    throw new PhotoValidationError("Photos must be 50 MB or less in total.");
  }
  const storage = dependencies.storage;
  const stored: StoredPhotoInput[] = [];
  let removedStorageKeys: string[] = [];
  try {
    for (let index = 0; index < normalized.length; index += 1) {
      const result = await storage.put({
        bytes: normalized[index].bytes,
        mimeType: normalized[index].mimeType,
      });
      const sortOrder = order.findIndex(
        (item) => item.kind === "new" && item.id === newIds[index],
      );
      const { originalFilename, mimeType, sizeBytes, width, height } =
        normalized[index];
      const metadata = { originalFilename, mimeType, sizeBytes, width, height };
      stored.push({ ...metadata, storageKey: result.key, sortOrder });
    }
    const result = await dependencies.feedback.updateFeedbackRecord({
      feedbackId,
      projectVersion,
      description,
      expectedPhotoIds: [...currentIds],
      retainedPhotos: orderedExisting.map((photo) => ({
        id: photo.id,
        sortOrder: order.findIndex((item) => item.id === photo.id),
      })),
      newPhotos: stored,
      storageNamespace: storage.namespace,
    });
    if (!result)
      throw new FeedbackUpdateNotFoundError("Feedback was not found.");
    removedStorageKeys = result.removedStorageKeys;
  } catch (error) {
    await dependencies
      .cleanupPhotos(stored.map((photo) => photo.storageKey))
      .catch(console.error);
    if (error instanceof FeedbackPhotoStateError)
      throw new PhotoValidationError(error.message);
    throw error;
  }
  // Metadata has committed. Cleanup failure must not turn success into a rollback.
  await dependencies.cleanupPhotos(removedStorageKeys).catch(console.error);
  const saved = await dependencies.feedback.getFeedbackById(feedbackId);
  return saved ? presentFeedback(saved) : null;
}
