export function sanitizeFilenameSegment(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "feedback"
  );
}

export function singleExportFilename(projectName: string, version: string, date: Date) {
  return `feedy-${sanitizeFilenameSegment(projectName)}-${sanitizeFilenameSegment(version)}-${date
    .toISOString()
    .slice(0, 10)}.pdf`;
}

export function batchExportFilename(date: Date) {
  return `feedy-feedback-export-${date.toISOString().slice(0, 10)}.pdf`;
}
