import { deleteFeedback } from "@/server/application";
import { createFeedback } from "@/server/application";
import {
  readMultipartInput,
  readJsonInput,
  RequestInputError,
} from "@/lib/http/request-input";
import { ZodError } from "zod";

import {
  errorResponse,
  validationErrorResponse,
} from "@/lib/http/api-response";
import { PhotoValidationError } from "@/entities/photos";
import { ProjectNotFoundError } from "@/use-cases/feedback/create-feedback";
import { FeedbackDeleteNotFoundError } from "@/use-cases/feedback/delete-feedback";
import {
  createFeedbackFieldsSchema,
  deleteFeedbackSchema,
} from "@/lib/validation/feedback";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await readMultipartInput(request);
    const photos = formData
      .getAll("photos")
      .filter((value): value is File => value instanceof File);
    const fields = createFeedbackFieldsSchema.parse({
      projectId: formData.get("projectId"),
      projectVersion: formData.get("projectVersion"),
      description: formData.get("description"),
    });
    const feedback = await createFeedback({ ...fields, photos });
    return Response.json(feedback, { status: 201 });
  } catch (error) {
    if (error instanceof RequestInputError)
      return errorResponse(error.status, error.code, error.message);
    if (error instanceof ZodError) return validationErrorResponse(error);
    if (error instanceof PhotoValidationError) {
      return errorResponse(400, "PHOTO_VALIDATION_ERROR", error.message, {
        photos: [error.message],
      });
    }
    if (error instanceof ProjectNotFoundError) {
      return errorResponse(404, "PROJECT_NOT_FOUND", error.message, {
        projectId: [error.message],
      });
    }
    console.error("Feedback creation failed", error);
    return errorResponse(
      500,
      "FEEDBACK_CREATE_FAILED",
      "Feedback could not be saved. Try again.",
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const input = deleteFeedbackSchema.parse(await readJsonInput(request));
    const result = await deleteFeedback(input);
    return Response.json(result);
  } catch (error) {
    if (error instanceof RequestInputError)
      return errorResponse(error.status, error.code, error.message);
    if (error instanceof ZodError) return validationErrorResponse(error);
    if (error instanceof SyntaxError) {
      return errorResponse(
        400,
        "INVALID_JSON",
        "The deletion request is not valid JSON.",
      );
    }
    if (error instanceof FeedbackDeleteNotFoundError) {
      return errorResponse(404, "FEEDBACK_NOT_FOUND", error.message);
    }
    console.error("Feedback deletion failed", error);
    return errorResponse(
      500,
      "FEEDBACK_DELETE_FAILED",
      "Feedback could not be deleted. Try again.",
    );
  }
}
