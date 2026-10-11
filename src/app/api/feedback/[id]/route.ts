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
import {
  feedbackIdSchema,
  updateFeedbackFieldsSchema,
  updateFeedbackNewPhotoIdsSchema,
  updateFeedbackPhotoOrderSchema,
} from "@/lib/validation/feedback";

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
    const newPhotos: File[] = [];
    for (const value of formData.getAll("newPhotos")) {
      if (!(value instanceof File))
        throw new PhotoValidationError("The photo upload is invalid.");
      newPhotos.push(value);
    }
    const rawPhotoOrder: unknown = JSON.parse(rawOrder);
    const feedbackId = feedbackIdSchema.parse(id);
    const fields = updateFeedbackFieldsSchema.parse({
      projectVersion: formData.get("projectVersion"),
      description: formData.get("description"),
    });
    const photoOrder = updateFeedbackPhotoOrderSchema.parse(rawPhotoOrder);
    const newPhotoIds = updateFeedbackNewPhotoIdsSchema.parse(
      formData.getAll("newPhotoIds"),
    );
    const feedback = await updateFeedback({
      feedbackId,
      ...fields,
      photoOrder,
      newPhotoIds,
      newPhotos,
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
