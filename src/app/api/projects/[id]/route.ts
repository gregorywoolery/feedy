import { ZodError } from "zod"

import { errorResponse, validationErrorResponse } from "@/lib/http/api-response"
import {
  deleteProjectUseCase,
  ProjectDeleteNotFoundError,
} from "@/use-cases/projects/delete-project"

export const runtime = "nodejs"

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  try {
    return Response.json(await deleteProjectUseCase(id))
  } catch (error) {
    if (error instanceof ZodError) return validationErrorResponse(error)
    if (error instanceof ProjectDeleteNotFoundError) {
      return errorResponse(404, "PROJECT_NOT_FOUND", error.message)
    }
    console.error("Project deletion failed", error)
    return errorResponse(500, "PROJECT_DELETE_FAILED", "The project could not be deleted. Try again.")
  }
}
