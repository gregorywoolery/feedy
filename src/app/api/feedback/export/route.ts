import { ZodError } from "zod";

import { listFeedbackIds } from "@/data-access/feedback/feedback-repository";
import { batchExportFilename } from "@/lib/export/filename";
import { createFeedbackPdf } from "@/lib/export/pdf";
import { errorResponse, validationErrorResponse } from "@/lib/http/api-response";
import { exportFeedbackSchema } from "@/lib/validation/feedback";
import {
  FeedbackExportNotFoundError,
  getExportRecords
} from "@/use-cases/exports/get-export-records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILTERED_EXPORT_LIMIT = 500;

export async function POST(request: Request) {
  try {
    const exportRequest = exportFeedbackSchema.parse(await request.json());
    let ids: string[];

    if ("ids" in exportRequest) {
      ids = exportRequest.ids;
    } else {
      const result = await listFeedbackIds(
        { ...exportRequest.query, page: 1, pageSize: 100 },
        FILTERED_EXPORT_LIMIT
      );
      if (result.exceedsMaximum) {
        return errorResponse(
          400,
          "EXPORT_LIMIT_EXCEEDED",
          `Narrow the filters to ${FILTERED_EXPORT_LIMIT} feedback items or fewer before exporting.`
        );
      }
      if (!result.ids.length) {
        return errorResponse(404, "NO_FEEDBACK_MATCHES", "No feedback matches the active filters.");
      }
      ids = result.ids;
    }

    const generatedAt = new Date();
    const records = await getExportRecords(ids);
    const pdf = await createFeedbackPdf(records, generatedAt);
    const filename = batchExportFilename(generatedAt);
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.byteLength),
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    if (error instanceof ZodError) return validationErrorResponse(error);
    if (error instanceof SyntaxError) {
      return errorResponse(400, "INVALID_JSON", "The export request is not valid JSON.");
    }
    if (error instanceof FeedbackExportNotFoundError) {
      return errorResponse(404, "FEEDBACK_NOT_FOUND", error.message);
    }
    console.error("Batch feedback export failed", error);
    return errorResponse(500, "EXPORT_FAILED", "The PDF could not be generated. Try again.");
  }
}
