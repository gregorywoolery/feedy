// @vitest-environment node

import sharp from "sharp";
import {
  decodePDFRawStream,
  PDFArray,
  PDFContentStream,
  PDFDocument,
  PDFRawStream,
  type PDFStream,
} from "pdf-lib";
import { describe, expect, it } from "vitest";

import type { FeedbackExportRecord } from "@/entities/contracts/feedback";
import {
  batchExportFilename,
  sanitizeFilenameSegment,
  singleExportFilename,
} from "@/lib/export/filename";
import { createFeedbackPdf } from "@/lib/export/pdf";

const GENERATED_AT = new Date("2026-08-30T14:25:00.000Z");

function record(
  overrides: Partial<FeedbackExportRecord> = {},
): FeedbackExportRecord {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    projectId: "11111111-1111-4111-8111-111111111111",
    projectName: "Alpha portal",
    projectVersion: "2.1.0",
    description: "The upload state needs a clearer progress indicator.",
    photos: [],
    photoCount: 0,
    photoBytes: [],
    createdAt: "2026-08-28T10:15:00.000Z",
    updatedAt: "2026-08-29T12:30:00.000Z",
    ...overrides,
  };
}

function streamBytes(stream: PDFStream) {
  if (stream instanceof PDFRawStream) {
    return decodePDFRawStream(stream).decode();
  }
  if (stream instanceof PDFContentStream) {
    return stream.getUnencodedContents();
  }
  return stream.getContents();
}

function pageText(document: PDFDocument, pageIndex: number) {
  const contents = document.getPage(pageIndex).node.Contents();
  const streams =
    contents instanceof PDFArray
      ? contents
          .asArray()
          .map((entry) => document.context.lookup(entry) as PDFStream)
      : contents
        ? [contents as PDFStream]
        : [];
  const operators = streams
    .map((stream) => Buffer.from(streamBytes(stream)).toString("latin1"))
    .join("\n");

  return Array.from(operators.matchAll(/<([0-9a-f]+)>\s*Tj/gi))
    .map((match) => Buffer.from(match[1], "hex").toString("latin1"))
    .join("\n");
}

async function photo(
  originalFilename: string,
  sortOrder: number,
  format: "png" | "webp",
) {
  const bytes = await sharp({
    create: {
      width: 40,
      height: 30,
      channels: 3,
      background: format === "png" ? "#245bd6" : "#14a37f",
    },
  })
    [format]()
    .toBuffer();
  const mimeType = format === "png" ? "image/png" : "image/webp";

  return {
    id: `33333333-3333-4333-8333-${String(sortOrder).padStart(12, "0")}`,
    originalFilename,
    mimeType,
    sizeBytes: bytes.byteLength,
    width: 40,
    height: 30,
    sortOrder,
    url: `/api/photos/${sortOrder}`,
    bytes: Uint8Array.from(bytes),
  } as const;
}

describe("export filenames", () => {
  it("normalizes accents, punctuation, repeated separators, and empty input", () => {
    expect(sanitizeFilenameSegment("  Crème brûlée / Alpha_v1.0  ")).toBe(
      "creme-brulee-alpha-v1-0",
    );
    expect(sanitizeFilenameSegment("---***---")).toBe("feedback");
    expect(sanitizeFilenameSegment("x".repeat(80))).toBe("x".repeat(60));
  });

  it("creates deterministic single and batch PDF names", () => {
    expect(singleExportFilename("Alpha Portal", "v2.1 RC", GENERATED_AT)).toBe(
      "feedy-alpha-portal-v2-1-rc-2026-08-30.pdf",
    );
    expect(batchExportFilename(GENERATED_AT)).toBe(
      "feedy-feedback-export-2026-08-30.pdf",
    );
  });
});

describe("createFeedbackPdf", () => {
  it("rejects an export with no feedback records", async () => {
    await expect(createFeedbackPdf([], GENERATED_AT)).rejects.toThrow(
      /At least one feedback record is required/,
    );
  });

  it("creates a valid one-page, no-photo PDF with document metadata", async () => {
    const bytes = await createFeedbackPdf([record()], GENERATED_AT);

    expect(Buffer.from(bytes.subarray(0, 5)).toString("ascii")).toBe("%PDF-");
    const document = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(document.getPageCount()).toBe(1);
    expect(document.getTitle()).toBe("Feedy feedback record");
    expect(document.getAuthor()).toBe("Feedy");
    expect(document.getCreator()).toBe("Feedy");
    expect(document.getCreationDate()?.toISOString()).toBe(
      GENERATED_AT.toISOString(),
    );
    expect(document.getPage(0).getSize()).toEqual({
      width: 595.28,
      height: 841.89,
    });
    expect(pageText(document, 0)).toContain("Alpha portal");
    expect(pageText(document, 0)).toContain("No photos attached");
  });

  it("keeps representative records and their photos in the supplied order", async () => {
    const firstPhoto = await photo("01-overview.png", 0, "png");
    const secondPhoto = await photo("02-details.webp", 1, "webp");
    const records = [
      record({
        projectName: "First project",
        projectVersion: "1.0.0",
        description: "First record description",
      }),
      record({
        id: "44444444-4444-4444-8444-444444444444",
        projectId: "55555555-5555-4555-8555-555555555555",
        projectName: "Second project",
        projectVersion: "3.0.0",
        description: "Second record description",
        photos: [firstPhoto, secondPhoto],
        photoCount: 2,
        photoBytes: [firstPhoto, secondPhoto],
      }),
    ];

    const bytes = await createFeedbackPdf(records, GENERATED_AT);
    const document = await PDFDocument.load(bytes, { updateMetadata: false });

    expect(document.getTitle()).toBe("Feedy feedback export");
    expect(document.getPageCount()).toBe(4);
    expect(pageText(document, 0)).toContain("Feedback export");
    const contents = pageText(document, 1);
    expect(contents.indexOf("First project")).toBeLessThan(
      contents.indexOf("Second project"),
    );
    expect(pageText(document, 2)).toContain("First record description");
    const secondRecord = pageText(document, 3);
    expect(secondRecord).toContain("Second record description");
    expect(secondRecord.indexOf("01-overview.png")).toBeLessThan(
      secondRecord.indexOf("02-details.webp"),
    );
  });
});
