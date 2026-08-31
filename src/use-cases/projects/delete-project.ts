import { deleteProjectRecord } from "@/data-access/projects/project-repository"
import { getPhotoStorage } from "@/lib/storage"
import { projectIdSchema } from "@/lib/validation/projects"

export class ProjectDeleteNotFoundError extends Error {
  constructor() {
    super("The project no longer exists.")
    this.name = "ProjectDeleteNotFoundError"
  }
}

export async function deleteProjectUseCase(projectId: unknown) {
  const id = projectIdSchema.parse(projectId)
  const result = await deleteProjectRecord(id)
  if (!result.deleted) throw new ProjectDeleteNotFoundError()

  const storage = getPhotoStorage()
  const cleanup = await Promise.allSettled(
    result.storageKeys.map((storageKey) => storage.delete(storageKey))
  )
  const cleanupFailures = cleanup.filter((item) => item.status === "rejected").length

  if (cleanupFailures) {
    console.error(`Project deletion left ${cleanupFailures} photo file(s) pending cleanup.`)
  }

  return {
    deletedFeedbackCount: result.feedbackCount,
    cleanupPending: cleanupFailures
  }
}
