import type { ApplicationDependencies } from "@/use-cases/ports";
import { projectIdSchema } from "@/lib/validation/projects";

export class ProjectDeleteNotFoundError extends Error {
  constructor() {
    super("The project no longer exists.");
    this.name = "ProjectDeleteNotFoundError";
  }
}

export async function deleteProjectUseCase(
  projectId: unknown,
  dependencies: ApplicationDependencies,
) {
  const id = projectIdSchema.parse(projectId);
  const result = await dependencies.projects.deleteProjectRecord(
    id,
    dependencies.storage.namespace,
  );
  if (!result.deleted) throw new ProjectDeleteNotFoundError();

  const cleanupFailures = await dependencies.cleanupPhotos(result.storageKeys);

  if (cleanupFailures) {
    console.error(
      `Project deletion left ${cleanupFailures} photo file(s) pending cleanup.`,
    );
  }

  return {
    deletedFeedbackCount: result.feedbackCount,
    cleanupPending: cleanupFailures,
  };
}
