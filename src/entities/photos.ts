export type PhotoMimeType = "image/jpeg" | "image/png" | "image/webp";

export interface PhotoMetadata {
  originalFilename: string;
  mimeType: PhotoMimeType;
  sizeBytes: number;
  width: number | null;
  height: number | null;
}

export interface NormalizedPhoto extends PhotoMetadata {
  bytes: Uint8Array;
}

export interface StoredPhotoInput extends PhotoMetadata {
  storageKey: string;
  sortOrder: number;
}

export class PhotoValidationError extends Error {}
export class FeedbackPhotoStateError extends Error {}
