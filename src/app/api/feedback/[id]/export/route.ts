import { exportFeedback } from "@/server/application";
import { errorResponse } from "@/lib/http/api-response";
import { pdfResponse } from "@/lib/http/pdf-response";
import { feedbackIdSchema } from "@/lib/validation/feedback";
import { FeedbackExportNotFoundError } from "@/use-cases/exports/get-export-records";
import {
  ExportLimitError,
  ExportBusyError,
} from "@/use-cases/exports/export-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!feedbackIdSchema.safeParse(id).success)
    return errorResponse(
      400,
      "INVALID_FEEDBACK_ID",
      "The feedback identifier is invalid.",
    );
  try {
    const { pdf, filename } = await exportFeedback({ ids: [id] }, true);
    return pdfResponse(pdf, filename);
  } catch (error) {
    if (error instanceof ExportLimitError)
      return errorResponse(400, "EXPORT_LIMIT_EXCEEDED", error.message);
    if (error instanceof ExportBusyError)
      return errorResponse(429, "EXPORT_BUSY", error.message);
    if (error instanceof FeedbackExportNotFoundError)
      return errorResponse(404, "FEEDBACK_NOT_FOUND", error.message);
    console.error("Single feedback export failed", error);
    return errorResponse(
      500,
      "EXPORT_FAILED",
      "The PDF could not be generated. Try again.",
    );
  }
}
