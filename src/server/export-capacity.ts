import { ExportBusyError } from "@/use-cases/exports/export-limits";

let exportRunning = false;

/** One export per process, including storage reads. Other instances have their own limit. */
export async function withExportCapacity<T>(
  operation: () => Promise<T>,
): Promise<T> {
  if (exportRunning)
    throw new ExportBusyError(
      "Another PDF is being prepared. Try again shortly.",
    );
  exportRunning = true;
  try {
    return await operation();
  } finally {
    exportRunning = false;
  }
}
