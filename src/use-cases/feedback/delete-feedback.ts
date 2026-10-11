import type { ApplicationDependencies } from "@/use-cases/ports";
import type { DeleteFeedbackInput } from "@/lib/validation/feedback";

export class FeedbackDeleteNotFoundError extends Error {
  constructor() {
    super("The selected feedback no longer exists.");
    this.name = "FeedbackDeleteNotFoundError";
  }
}

export async function deleteFeedbackUseCase(
  input: DeleteFeedbackInput,
  dependencies: ApplicationDependencies,
) {
  const { ids } = input;
  const result = await dependencies.feedback.deleteFeedbackRecords(
    ids,
    dependencies.storage.namespace,
  );
  if (!result.deletedIds.length) throw new FeedbackDeleteNotFoundError();

  const cleanupFailures = await dependencies.cleanupPhotos(result.storageKeys);

  if (cleanupFailures) {
    console.error(
      `Feedback deletion left ${cleanupFailures} photo file(s) pending cleanup.`,
    );
  }

  return {
    deletedCount: result.deletedIds.length,
    cleanupPending: cleanupFailures,
  };
}
