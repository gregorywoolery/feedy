import type { ApplicationDependencies } from "@/use-cases/ports";
import { exportFeedbackSchema } from "@/lib/validation/feedback";
import {
  batchExportFilename,
  singleExportFilename,
} from "@/lib/export/filename";
import {
  FeedbackExportNotFoundError,
  getExportRecords,
} from "./get-export-records";
import { ExportLimitError, MAX_FILTERED_EXPORT_RECORDS } from "./export-limits";

export async function exportFeedbackUseCase(
  input: unknown,
  dependencies: ApplicationDependencies,
  single = false,
) {
  const selection = exportFeedbackSchema.parse(input);
  let ids: string[];
  if ("ids" in selection) {
    ids = selection.ids;
  } else {
    const result = await dependencies.feedback.listFeedbackIds(
      { ...selection.query, page: 1, pageSize: 100 },
      MAX_FILTERED_EXPORT_RECORDS,
    );
    if (result.exceedsMaximum)
      throw new ExportLimitError(
        "Narrow the filters to 500 feedback items or fewer.",
      );
    if (!result.ids.length) throw new FeedbackExportNotFoundError();
    ids = result.ids;
  }
  const records = await getExportRecords(ids, dependencies);
  const generatedAt = new Date();
  const pdf = await dependencies.renderPdf(records, generatedAt);
  const filename = single
    ? singleExportFilename(
        records[0].projectName,
        records[0].projectVersion,
        generatedAt,
      )
    : batchExportFilename(generatedAt);
  return { pdf, filename };
}
