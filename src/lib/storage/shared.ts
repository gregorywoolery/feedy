export const STORAGE_KEY_PATTERN = /^[a-f0-9]{64}\.(?:jpg|png|webp)$/;
export const MAX_KEY_GENERATION_ATTEMPTS = 4;

export const extensionByMimeType = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export const mimeTypeByExtension = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

export type SupportedMimeType = keyof typeof extensionByMimeType;

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
