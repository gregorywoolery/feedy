import { ZodError } from "zod";
import { exportFeedback } from "@/server/application";
import {
  errorResponse,
  validationErrorResponse,
} from "@/lib/http/api-response";
import { readJsonInput, RequestInputError } from "@/lib/http/request-input";
import { pdfResponse } from "@/lib/http/pdf-response";
import { exportFeedbackSchema } from "@/lib/validation/feedback";
import { FeedbackExportNotFoundError } from "@/use-cases/exports/get-export-records";
import {
  ExportLimitError,
  ExportBusyError,
} from "@/use-cases/exports/export-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = exportFeedbackSchema.parse(await readJsonInput(request));
    const { pdf, filename } = await exportFeedback(input);
    return pdfResponse(pdf, filename);
  } catch (error) {
    if (error instanceof RequestInputError)
      return errorResponse(error.status, error.code, error.message);
    if (error instanceof ZodError) return validationErrorResponse(error);
    if (error instanceof SyntaxError)
      return errorResponse(
        400,
        "INVALID_JSON",
        "The export request is not valid JSON.",
      );
    if (error instanceof ExportLimitError)
      return errorResponse(400, "EXPORT_LIMIT_EXCEEDED", error.message);
    if (error instanceof ExportBusyError)
      return errorResponse(429, "EXPORT_BUSY", error.message);
    if (error instanceof FeedbackExportNotFoundError)
      return errorResponse(404, "FEEDBACK_NOT_FOUND", error.message);
    console.error("Batch feedback export failed", error);
    return errorResponse(
      500,
      "EXPORT_FAILED",
      "The PDF could not be generated. Try again.",
    );
  }
}
