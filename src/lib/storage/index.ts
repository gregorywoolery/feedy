import { DatabasePhotoStorage } from "@/lib/storage/database";
import { LocalPhotoStorage } from "@/lib/storage/local";
import type { PhotoStorage } from "@/lib/storage/types";

export type { PhotoStorage } from "@/lib/storage/types";

let cachedStorage:
  | { configurationKey: string; storage: PhotoStorage }
  | undefined;

export function getPhotoStorage(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): PhotoStorage {
  const driver = environment.STORAGE_DRIVER?.trim().toLowerCase() || "local";
  const uploadDir = environment.UPLOAD_DIR?.trim() || "";
  const configurationKey = `${driver}:${uploadDir}`;

  if (cachedStorage?.configurationKey === configurationKey) {
    return cachedStorage.storage;
  }

  if (driver === "database") {
    const storage = new DatabasePhotoStorage();
    cachedStorage = { configurationKey, storage };
    return storage;
  }

  if (driver !== "local") {
    throw new Error(
      `Unsupported STORAGE_DRIVER "${driver}". Use "local" or "database".`,
    );
  }

  const storage = new LocalPhotoStorage({
    uploadDir: uploadDir || undefined,
  });
  cachedStorage = { configurationKey, storage };
  return storage;
}
