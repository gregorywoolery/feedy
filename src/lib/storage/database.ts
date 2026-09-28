import { randomBytes } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/database/client";
import { photoObjects } from "@/lib/database/schema";
import type { PhotoStorage } from "@/lib/storage/types";
import {
  InvalidStorageKeyError,
  UnsupportedPhotoMimeTypeError,
} from "@/lib/storage/shared";

import {
  STORAGE_KEY_PATTERN,
  MAX_KEY_GENERATION_ATTEMPTS,
  extensionByMimeType,
} from "./shared";

function isUniqueViolation(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505",
  );
}

export class DatabasePhotoStorage implements PhotoStorage {
  readonly namespace = "database";
  async put(input: { bytes: Uint8Array; mimeType: string }) {
    if (!(input.mimeType in extensionByMimeType)) {
      throw new UnsupportedPhotoMimeTypeError(input.mimeType);
    }
    if (!input.bytes.byteLength)
      throw new Error("Cannot store an empty photo.");

    const extension =
      extensionByMimeType[input.mimeType as keyof typeof extensionByMimeType];
    for (let attempt = 0; attempt < MAX_KEY_GENERATION_ATTEMPTS; attempt += 1) {
      const key = `${randomBytes(32).toString("hex")}.${extension}`;
      try {
        await db.insert(photoObjects).values({
          key,
          bytes: Buffer.from(input.bytes),
          mimeType: input.mimeType,
        });
        return { key };
      } catch (error) {
        if (isUniqueViolation(error)) continue;
        throw error;
      }
    }

    throw new Error("Unable to allocate a unique photo storage key.");
  }

  async get(key: string) {
    if (!STORAGE_KEY_PATTERN.test(key)) throw new InvalidStorageKeyError();
    const [object] = await db
      .select({ bytes: photoObjects.bytes, mimeType: photoObjects.mimeType })
      .from(photoObjects)
      .where(
        and(
          eq(photoObjects.key, key),
          sql`octet_length(${photoObjects.bytes}) <= 10485760`,
        ),
      )
      .limit(1);
    if (!object) throw new Error("The stored photo could not be found.");
    return { bytes: new Uint8Array(object.bytes), mimeType: object.mimeType };
  }

  async delete(key: string) {
    if (!STORAGE_KEY_PATTERN.test(key)) throw new InvalidStorageKeyError();
    await db.delete(photoObjects).where(eq(photoObjects.key, key));
  }
}
