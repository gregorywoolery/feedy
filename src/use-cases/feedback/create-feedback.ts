import { presentFeedback } from "@/use-cases/present-feedback";
import type { StoredPhotoInput } from "@/entities/photos";
import type { ApplicationDependencies } from "@/use-cases/ports";
import { createFeedbackFieldsSchema } from "@/lib/validation/feedback";

export class ProjectNotFoundError extends Error {
  constructor() {
    super("The selected project no longer exists.");
    this.name = "ProjectNotFoundError";
  }
}

export async function createFeedbackUseCase(
  input: {
    projectId: unknown;
    projectVersion: unknown;
    description: unknown;
    photos: File[];
  },
  dependencies: ApplicationDependencies,
) {
  const fields = createFeedbackFieldsSchema.parse({
    projectId: input.projectId,
    projectVersion: input.projectVersion,
    description: input.description,
  });
  if (!(await dependencies.projects.projectExists(fields.projectId)))
    throw new ProjectNotFoundError();

  const photos = await dependencies.normalizePhotos(input.photos);
  const storage = dependencies.storage;
  const stored: StoredPhotoInput[] = [];

  let feedbackId: string;
  try {
    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];
      const result = await storage.put({
        bytes: photo.bytes,
        mimeType: photo.mimeType,
      });
      const { originalFilename, mimeType, sizeBytes, width, height } = photo;
      const metadata = { originalFilename, mimeType, sizeBytes, width, height };
      stored.push({ ...metadata, storageKey: result.key, sortOrder: index });
    }

    feedbackId = await dependencies.feedback.createFeedbackRecord({
      ...fields,
      photos: stored,
    });
  } catch (error) {
    await dependencies
      .cleanupPhotos(stored.map((photo) => photo.storageKey))
      .catch(console.error);
    throw error;
  }
  const saved = await dependencies.feedback.getFeedbackById(feedbackId);
  return saved ? presentFeedback(saved) : null;
}
