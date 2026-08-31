import { deleteFeedbackRecords } from "@/data-access/feedback/feedback-repository"
import { getPhotoStorage } from "@/lib/storage"
import { deleteFeedbackSchema } from "@/lib/validation/feedback"

export class FeedbackDeleteNotFoundError extends Error {
  constructor() {
    super("The selected feedback no longer exists.")
    this.name = "FeedbackDeleteNotFoundError"
  }
}

export async function deleteFeedbackUseCase(input: unknown) {
  const { ids } = deleteFeedbackSchema.parse(input)
  const result = await deleteFeedbackRecords(ids)
  if (!result.deletedIds.length) throw new FeedbackDeleteNotFoundError()

  const storage = getPhotoStorage()
  const cleanup = await Promise.allSettled(
    result.storageKeys.map((storageKey) => storage.delete(storageKey))
  )
  const cleanupFailures = cleanup.filter((item) => item.status === "rejected").length

  if (cleanupFailures) {
    console.error(`Feedback deletion left ${cleanupFailures} photo file(s) pending cleanup.`)
  }

  return {
    deletedCount: result.deletedIds.length,
    cleanupPending: cleanupFailures
  }
}
