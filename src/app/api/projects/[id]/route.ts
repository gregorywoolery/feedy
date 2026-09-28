import { deleteProject } from "@/server/application";
import { assertSameOrigin, RequestInputError } from "@/lib/http/request-input";
import { ZodError } from "zod";

import {
  errorResponse,
  validationErrorResponse,
} from "@/lib/http/api-response";
import { ProjectDeleteNotFoundError } from "@/use-cases/projects/delete-project";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    assertSameOrigin(request);
    return Response.json(await deleteProject(id));
  } catch (error) {
    if (error instanceof RequestInputError)
      return errorResponse(error.status, error.code, error.message);
    if (error instanceof ZodError) return validationErrorResponse(error);
    if (error instanceof ProjectDeleteNotFoundError) {
      return errorResponse(404, "PROJECT_NOT_FOUND", error.message);
    }
    console.error("Project deletion failed", error);
    return errorResponse(
      500,
      "PROJECT_DELETE_FAILED",
      "The project could not be deleted. Try again.",
    );
  }
}
