import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  InvalidStorageKeyError,
  LocalPhotoStorage,
  UnsupportedPhotoMimeTypeError,
} from "@/lib/storage/local";
import { DatabasePhotoStorage } from "@/lib/storage/database";
import { getPhotoStorage } from "@/lib/storage";

describe("LocalPhotoStorage", () => {
  let uploadDir: string;

  beforeEach(async () => {
    uploadDir = await mkdtemp(path.join(os.tmpdir(), "feedy-storage-test-"));
  });

  afterEach(async () => {
    await rm(uploadDir, { force: true, recursive: true });
  });

  it("round-trips supported photo bytes and MIME metadata", async () => {
    const storage = new LocalPhotoStorage({ uploadDir });
    const input = Uint8Array.from([1, 2, 3, 4, 5]);

    const { key } = await storage.put({
      bytes: input,
      mimeType: "image/png",
    });
    const stored = await storage.get(key);

    expect(key).toMatch(/^[a-f0-9]{64}\.png$/);
    expect(stored.mimeType).toBe("image/png");
    expect(Array.from(stored.bytes)).toEqual(Array.from(input));
  });

  it("generates a different opaque key for every write", async () => {
    const storage = new LocalPhotoStorage({ uploadDir });
    const first = await storage.put({
      bytes: Uint8Array.from([1]),
      mimeType: "image/jpeg",
    });
    const second = await storage.put({
      bytes: Uint8Array.from([1]),
      mimeType: "image/jpeg",
    });

    expect(first.key).not.toBe(second.key);
    expect(first.key).not.toContain("..");
    expect(first.key).not.toContain("/");
  });

  it("rejects traversal and malformed storage keys", async () => {
    const storage = new LocalPhotoStorage({ uploadDir });

    await expect(storage.get("../../etc/passwd")).rejects.toBeInstanceOf(
      InvalidStorageKeyError,
    );
    await expect(storage.delete("not-a-key.png")).rejects.toBeInstanceOf(
      InvalidStorageKeyError,
    );
  });

  it("rejects unsupported MIME types and empty photos", async () => {
    const storage = new LocalPhotoStorage({ uploadDir });

    await expect(
      storage.put({ bytes: Uint8Array.from([1]), mimeType: "image/svg+xml" }),
    ).rejects.toBeInstanceOf(UnsupportedPhotoMimeTypeError);
    await expect(
      storage.put({ bytes: new Uint8Array(), mimeType: "image/webp" }),
    ).rejects.toThrow(/empty photo/);
  });

  it("deletes stored photos and treats a repeated delete as successful", async () => {
    const storage = new LocalPhotoStorage({ uploadDir });
    const { key } = await storage.put({
      bytes: Uint8Array.from([7, 8, 9]),
      mimeType: "image/webp",
    });

    await storage.delete(key);
    await storage.delete(key);
    await expect(storage.get(key)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("getPhotoStorage", () => {
  it("returns a stable local adapter for one configuration", () => {
    const environment = {
      STORAGE_DRIVER: "local",
      UPLOAD_DIR: path.join(os.tmpdir(), "feedy-storage-factory"),
    };

    expect(getPhotoStorage(environment)).toBe(getPhotoStorage(environment));
  });

  it("supports database-backed storage for serverless deployments", () => {
    const storage = getPhotoStorage({ STORAGE_DRIVER: "database" });
    expect(storage).toBeInstanceOf(DatabasePhotoStorage);
    expect(getPhotoStorage({ STORAGE_DRIVER: "database" })).toBe(storage);
  });

  it("fails clearly for storage drivers that are not implemented", () => {
    expect(() => getPhotoStorage({ STORAGE_DRIVER: "s3" })).toThrow(
      /Use "local" or "database"/,
    );
  });
});
