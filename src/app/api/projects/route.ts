import { ZodError } from "zod";

import { errorResponse, validationErrorResponse } from "@/lib/http/api-response";
import { createProjectUseCase } from "@/use-cases/projects/create-project";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const project = await createProjectUseCase(await request.json());
    return Response.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return validationErrorResponse(error);
    if (error instanceof SyntaxError) {
      return errorResponse(400, "INVALID_JSON", "The project request is not valid JSON.");
    }
    console.error("Project creation failed", error);
    return errorResponse(500, "PROJECT_CREATE_FAILED", "The project could not be created. Try again.");
  }
}
