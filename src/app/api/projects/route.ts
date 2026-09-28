import { createProject } from "@/server/application";
import { readJsonInput, RequestInputError } from "@/lib/http/request-input";
import { ZodError } from "zod";

import {
  errorResponse,
  validationErrorResponse,
} from "@/lib/http/api-response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const project = await createProject(await readJsonInput(request));
    return Response.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof RequestInputError)
      return errorResponse(error.status, error.code, error.message);
    if (error instanceof ZodError) return validationErrorResponse(error);
    if (error instanceof SyntaxError) {
      return errorResponse(
        400,
        "INVALID_JSON",
        "The project request is not valid JSON.",
      );
    }
    console.error("Project creation failed", error);
    return errorResponse(
      500,
      "PROJECT_CREATE_FAILED",
      "The project could not be created. Try again.",
    );
  }
}
