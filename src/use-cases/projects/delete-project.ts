import type { ApplicationDependencies } from "@/use-cases/ports";

export class ProjectDeleteNotFoundError extends Error {
  constructor() {
    super("The project no longer exists.");
    this.name = "ProjectDeleteNotFoundError";
  }
}

export async function deleteProjectUseCase(
  projectId: string,
  dependencies: ApplicationDependencies,
) {
  const result = await dependencies.projects.deleteProjectRecord(
    projectId,
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
