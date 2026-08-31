import { randomBytes } from "node:crypto";
import { lstat, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { PhotoStorage } from "@/lib/storage/types";

const DEFAULT_UPLOAD_DIRECTORY = path.join(process.cwd(), "data", "uploads");
const STORAGE_KEY_PATTERN = /^[a-f0-9]{64}\.(?:jpg|png|webp)$/;
const MAX_KEY_GENERATION_ATTEMPTS = 4;

const extensionByMimeType = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

const mimeTypeByExtension = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

type SupportedMimeType = keyof typeof extensionByMimeType;

export class UnsupportedPhotoMimeTypeError extends Error {
  constructor(mimeType: string) {
    super(`Unsupported photo MIME type: ${mimeType || "(empty)"}.`);
    this.name = "UnsupportedPhotoMimeTypeError";
  }
}

export class InvalidStorageKeyError extends Error {
  constructor() {
    super("The photo storage key is invalid.");
    this.name = "InvalidStorageKeyError";
  }
}

export interface LocalPhotoStorageOptions {
  uploadDir?: string;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function validateUploadDirectory(uploadDir: string): string {
  const resolved = path.resolve(uploadDir);
  const publicDirectory = path.resolve(process.cwd(), "public");

  if (isInside(publicDirectory, resolved)) {
    throw new Error("UPLOAD_DIR must be outside the public directory.");
  }

  return resolved;
}

function parseStorageKey(key: string): {
  extension: keyof typeof mimeTypeByExtension;
} {
  if (!STORAGE_KEY_PATTERN.test(key)) {
    throw new InvalidStorageKeyError();
  }

  const extension = key.slice(key.lastIndexOf(".") + 1);
  if (!(extension in mimeTypeByExtension)) {
    throw new InvalidStorageKeyError();
  }

  return { extension: extension as keyof typeof mimeTypeByExtension };
}

export class LocalPhotoStorage implements PhotoStorage {
  readonly uploadDir: string;

  constructor(options: LocalPhotoStorageOptions = {}) {
    this.uploadDir = validateUploadDirectory(
      options.uploadDir?.trim() ||
        process.env.UPLOAD_DIR?.trim() ||
        DEFAULT_UPLOAD_DIRECTORY,
    );
  }

  async put(input: {
    bytes: Uint8Array;
    mimeType: string;
  }): Promise<{ key: string }> {
    if (!(input.mimeType in extensionByMimeType)) {
      throw new UnsupportedPhotoMimeTypeError(input.mimeType);
    }

    if (input.bytes.byteLength === 0) {
      throw new Error("Cannot store an empty photo.");
    }

    const mimeType = input.mimeType as SupportedMimeType;
    const extension = extensionByMimeType[mimeType];
    await mkdir(this.uploadDir, { mode: 0o700, recursive: true });

    for (let attempt = 0; attempt < MAX_KEY_GENERATION_ATTEMPTS; attempt += 1) {
      const key = `${randomBytes(32).toString("hex")}.${extension}`;
      const destination = path.join(this.uploadDir, key);

      try {
        await writeFile(destination, input.bytes, { flag: "wx", mode: 0o600 });
        return { key };
      } catch (error) {
        if (isNodeError(error) && error.code === "EEXIST") {
          continue;
        }

        throw error;
      }
    }

    throw new Error("Unable to allocate a unique photo storage key.");
  }

  async get(key: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
    const { extension } = parseStorageKey(key);
    const source = path.join(this.uploadDir, key);
    const file = await lstat(source);

    if (!file.isFile() || file.isSymbolicLink()) {
      throw new InvalidStorageKeyError();
    }

    const bytes = await readFile(source);
    return {
      bytes: new Uint8Array(bytes),
      mimeType: mimeTypeByExtension[extension],
    };
  }

  async delete(key: string): Promise<void> {
    parseStorageKey(key);
    const destination = path.join(this.uploadDir, key);

    try {
      await unlink(destination);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return;
      }

      throw error;
    }
  }
}
