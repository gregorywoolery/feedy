import { updateFeedback } from "@/server/application";
import {
  readMultipartInput,
  RequestInputError,
} from "@/lib/http/request-input";
import { ZodError } from "zod";

import {
  errorResponse,
  validationErrorResponse,
} from "@/lib/http/api-response";
import { PhotoValidationError } from "@/entities/photos";
import { FeedbackUpdateNotFoundError } from "@/use-cases/feedback/update-feedback";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const formData = await readMultipartInput(request);
    const rawOrder = formData.get("photoOrder");
    if (typeof rawOrder !== "string") throw new SyntaxError();
    const files = formData.getAll("newPhotos");
    if (files.some((value) => !(value instanceof File)))
      throw new PhotoValidationError("The photo upload is invalid.");
    const feedback = await updateFeedback({
      feedbackId: id,
      projectVersion: formData.get("projectVersion"),
      description: formData.get("description"),
      photoOrder: JSON.parse(rawOrder),
      newPhotoIds: formData.getAll("newPhotoIds"),
      newPhotos: files as File[],
    });
    return Response.json(feedback);
  } catch (error) {
    if (error instanceof RequestInputError)
      return errorResponse(error.status, error.code, error.message);
    if (error instanceof ZodError) return validationErrorResponse(error);
    if (error instanceof SyntaxError)
      return errorResponse(
        400,
        "INVALID_PHOTO_ORDER",
        "The photo order is invalid.",
      );
    if (error instanceof PhotoValidationError)
      return errorResponse(400, "PHOTO_VALIDATION_ERROR", error.message, {
        photos: [error.message],
      });
    if (error instanceof FeedbackUpdateNotFoundError)
      return errorResponse(404, "FEEDBACK_NOT_FOUND", error.message);
    console.error("Feedback update failed", error);
    return errorResponse(
      500,
      "FEEDBACK_UPDATE_FAILED",
      "Feedback could not be updated. Try again.",
    );
  }
}
