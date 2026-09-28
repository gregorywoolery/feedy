export const MAX_EXPORT_BYTES = 50 * 1024 * 1024;
export const MAX_EXPORT_PHOTOS = 100;
export const MAX_FILTERED_EXPORT_RECORDS = 500;

export class ExportLimitError extends Error {}
export class ExportBusyError extends Error {}
