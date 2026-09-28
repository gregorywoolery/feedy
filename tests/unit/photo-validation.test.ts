// @vitest-environment node

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  MAX_PHOTO_BYTES,
  MAX_PHOTO_COUNT,
  PhotoValidationError,
  validateAndNormalizePhotos,
} from "@/lib/validation/photos";

function fileFromBytes(bytes: Uint8Array, name: string, type = ""): File {
  const copy = Uint8Array.from(bytes);
  return {
    name,
    type,
    size: copy.byteLength,
    arrayBuffer: async () =>
      copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength),
  } as File;
}

function sizedFile(size: number, name = "photo.png"): File {
  return {
    name,
    type: "image/png",
    size,
    arrayBuffer: async () => {
      throw new Error("size validation should happen before bytes are read");
    },
  } as unknown as File;
}

async function imageBytes(
  format: "jpeg" | "png" | "webp",
  width = 32,
  height = 24,
) {
  const image = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 45, g: 96, b: 210, alpha: 0.8 },
    },
  });
  return image[format]().toBuffer();
}

describe("validateAndNormalizePhotos", () => {
  it.each([
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
  ] as const)(
    "accepts and normalizes a real %s image",
    async (format, mimeType) => {
      const bytes = await imageBytes(format);
      const [photo] = await validateAndNormalizePhotos([
        fileFromBytes(bytes, `screen.${format}`, mimeType),
      ]);

      expect(photo).toMatchObject({
        originalFilename: `screen.${format}`,
        mimeType,
        width: 32,
        height: 24,
      });
      expect(photo.sizeBytes).toBe(photo.bytes.byteLength);
      expect(photo.sizeBytes).toBeGreaterThan(0);
      expect((await sharp(photo.bytes).metadata()).format).toBe(format);
    },
  );

  it("resizes large images and reduces unsafe filenames to a basename", async () => {
    const bytes = await imageBytes("png", 3_000, 30);
    const [photo] = await validateAndNormalizePhotos([
      fileFromBytes(bytes, "../captures/\u0000  homepage.png  ", "image/png"),
    ]);

    expect(photo.originalFilename).toBe("homepage.png");
    expect(photo.width).toBe(2_400);
    expect(photo.height).toBe(24);
  });

  it("uses the byte signature and rejects a declared MIME mismatch", async () => {
    const png = await imageBytes("png");

    await expect(
      validateAndNormalizePhotos([
        fileFromBytes(png, "actually-png.jpg", "image/jpeg"),
      ]),
    ).rejects.toThrow(/does not match its file type/);
    await expect(
      validateAndNormalizePhotos([
        fileFromBytes(
          new TextEncoder().encode("not an image"),
          "fake.png",
          "image/png",
        ),
      ]),
    ).rejects.toThrow(/not a supported JPEG, PNG, or WebP image/);
  });

  it("accepts a valid signature when the client omits its MIME declaration", async () => {
    const webp = await imageBytes("webp");
    const [photo] = await validateAndNormalizePhotos([
      fileFromBytes(webp, "capture.webp"),
    ]);

    expect(photo.mimeType).toBe("image/webp");
  });

  it("rejects empty, individually oversized, and collectively oversized files", async () => {
    await expect(
      validateAndNormalizePhotos([sizedFile(0, "empty.png")]),
    ).rejects.toThrow(/empty/);
    await expect(
      validateAndNormalizePhotos([
        sizedFile(MAX_PHOTO_BYTES + 1, "too-large.png"),
      ]),
    ).rejects.toThrow(/larger than 10 MB/);
    await expect(
      validateAndNormalizePhotos(
        Array.from({ length: 6 }, (_, index) =>
          sizedFile(9 * 1024 * 1024, `photo-${index}.png`),
        ),
      ),
    ).rejects.toThrow(/50 MB or less in total/);
  });

  it("rejects more than the maximum photo count before reading any bytes", async () => {
    await expect(
      validateAndNormalizePhotos(
        Array.from({ length: MAX_PHOTO_COUNT + 1 }, (_, index) =>
          sizedFile(1, `photo-${index}.png`),
        ),
      ),
    ).rejects.toEqual(
      new PhotoValidationError(`Add no more than ${MAX_PHOTO_COUNT} photos.`),
    );
  });
});
