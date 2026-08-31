import { createFeedbackRecord, getFeedbackById } from "@/data-access/feedback/feedback-repository";
import { projectExists } from "@/data-access/projects/project-repository";
import { getPhotoStorage } from "@/lib/storage";
import { createFeedbackFieldsSchema } from "@/lib/validation/feedback";
import { validateAndNormalizePhotos } from "@/lib/validation/photos";

export class ProjectNotFoundError extends Error {
  constructor() {
    super("The selected project no longer exists.");
    this.name = "ProjectNotFoundError";
  }
}

export async function createFeedbackUseCase(input: {
  projectId: unknown;
  projectVersion: unknown;
  description: unknown;
  photos: File[];
}) {
  const fields = createFeedbackFieldsSchema.parse({
    projectId: input.projectId,
    projectVersion: input.projectVersion,
    description: input.description
  });
  if (!(await projectExists(fields.projectId))) throw new ProjectNotFoundError();

  const photos = await validateAndNormalizePhotos(input.photos);
  const storage = getPhotoStorage();
  const stored: Array<(typeof photos)[number] & { storageKey: string; sortOrder: number }> = [];

  try {
    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];
      const result = await storage.put({ bytes: photo.bytes, mimeType: photo.mimeType });
      stored.push({ ...photo, storageKey: result.key, sortOrder: index });
    }

    const feedbackId = await createFeedbackRecord({ ...fields, photos: stored });
    return getFeedbackById(feedbackId);
  } catch (error) {
    await Promise.allSettled(stored.map((photo) => storage.delete(photo.storageKey)));
    throw error;
  }
}
