import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
async function main() {
  const { getDatabasePool } = await import("../src/lib/database/client");
  const { getPhotoStorage } = await import("../src/lib/storage");
  const { cleanupPhotos } = await import("../src/lib/storage/cleanup");
  const { findOrphanPhotoKeys } = await import("../src/lib/storage/reconcile");
  try {
    const storage = getPhotoStorage();
    const keys = await findOrphanPhotoKeys(storage);
    console.log(
      `Found ${keys.length} unreferenced photo object(s) older than 24 hours.`,
    );
    if (!process.argv.includes("--apply")) {
      console.log("Dry run. Use --apply to queue and delete these objects.");
      return;
    }
    const pending = await cleanupPhotos(storage, keys);
    console.log(`${pending} operation(s) remain queued for retry.`);
    if (pending) process.exitCode = 1;
  } finally {
    await getDatabasePool().end();
  }
}
main().catch((error) => {
  console.error("Reconciliation failed.", error);
  process.exitCode = 1;
});
