import { createFeedbackPdf } from "@/lib/export/pdf";
import { singleExportFilename } from "@/lib/export/filename";
import { errorResponse } from "@/lib/http/api-response";
import { feedbackIdSchema } from "@/lib/validation/feedback";
import {
  FeedbackExportNotFoundError,
  getExportRecords
} from "@/use-cases/exports/get-export-records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!feedbackIdSchema.safeParse(id).success) {
    return errorResponse(400, "INVALID_FEEDBACK_ID", "The feedback identifier is invalid.");
  }

  try {
    const generatedAt = new Date();
    const [record] = await getExportRecords([id]);
    const pdf = await createFeedbackPdf([record], generatedAt);
    const filename = singleExportFilename(record.projectName, record.projectVersion, generatedAt);
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.byteLength),
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    if (error instanceof FeedbackExportNotFoundError) {
      return errorResponse(404, "FEEDBACK_NOT_FOUND", error.message);
    }
    console.error("Single feedback export failed", error);
    return errorResponse(500, "EXPORT_FAILED", "The PDF could not be generated. Try again.");
  }
}
