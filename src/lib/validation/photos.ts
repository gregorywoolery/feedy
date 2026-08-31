import path from "node:path";

import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

import {
  MAX_PHOTO_BYTES,
  MAX_PHOTO_COUNT,
  MAX_TOTAL_PHOTO_BYTES
} from "@/lib/validation/photo-limits";

export { MAX_PHOTO_BYTES, MAX_PHOTO_COUNT, MAX_TOTAL_PHOTO_BYTES } from "@/lib/validation/photo-limits";
const MAX_INPUT_PIXELS = 40_000_000;

const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface ValidatedPhoto {
  bytes: Uint8Array;
  originalFilename: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  width: number | null;
  height: number | null;
  sizeBytes: number;
}

export class PhotoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoValidationError";
  }
}

function safeOriginalFilename(filename: string) {
  const basename = path.basename(filename).replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (basename || "photo").slice(0, 255);
}

export async function validateAndNormalizePhotos(files: File[]) {
  if (files.length > MAX_PHOTO_COUNT) {
    throw new PhotoValidationError(`Add no more than ${MAX_PHOTO_COUNT} photos.`);
  }

  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > MAX_TOTAL_PHOTO_BYTES) {
    throw new PhotoValidationError("Photos must be 50 MB or less in total.");
  }

  const normalized: ValidatedPhoto[] = [];

  for (const file of files) {
    if (file.size <= 0) {
      throw new PhotoValidationError(`${file.name || "A photo"} is empty.`);
    }
    if (file.size > MAX_PHOTO_BYTES) {
      throw new PhotoValidationError(`${file.name || "A photo"} is larger than 10 MB.`);
    }

    const input = Buffer.from(await file.arrayBuffer());
    const detected = await fileTypeFromBuffer(input);
    if (!detected || !supportedTypes.has(detected.mime)) {
      throw new PhotoValidationError(
        `${file.name || "A photo"} is not a supported JPEG, PNG, or WebP image.`
      );
    }

    if (file.type && file.type !== detected.mime) {
      throw new PhotoValidationError(`${file.name || "A photo"} does not match its file type.`);
    }

    const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).rotate();
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new PhotoValidationError(`${file.name || "A photo"} could not be decoded.`);
    }

    let output: Buffer;
    if (detected.mime === "image/jpeg") {
      output = await image
        .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 86, mozjpeg: true })
        .toBuffer();
    } else if (detected.mime === "image/png") {
      output = await image
        .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
        .png({ compressionLevel: 8 })
        .toBuffer();
    } else {
      output = await image
        .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 86 })
        .toBuffer();
    }

    const outputMetadata = await sharp(output).metadata();
    normalized.push({
      bytes: output,
      originalFilename: safeOriginalFilename(file.name),
      mimeType: detected.mime as ValidatedPhoto["mimeType"],
      width: outputMetadata.width ?? null,
      height: outputMetadata.height ?? null,
      sizeBytes: output.byteLength
    });
  }

  return normalized;
}
