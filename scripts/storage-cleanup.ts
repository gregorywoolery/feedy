import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
async function main() {
  const { getSqlClient } = await import("../src/lib/database/client");
  const { getPhotoStorage } = await import("../src/lib/storage");
  const { retryPhotoCleanup } = await import("../src/lib/storage/cleanup");
  try {
    const pending = await retryPhotoCleanup(getPhotoStorage());
    console.log(
      `Photo cleanup complete; ${pending} operation(s) still pending.`,
    );
    if (pending) process.exitCode = 1;
  } finally {
    await getSqlClient().end();
  }
}
main().catch((error) => {
  console.error("Photo cleanup failed.", error);
  process.exitCode = 1;
});
