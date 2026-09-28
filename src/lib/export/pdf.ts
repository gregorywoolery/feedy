import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import sharp from "sharp";

import type { FeedbackExportRecord } from "@/entities/contracts/feedback";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_Y = 27;
const INK = rgb(0.09, 0.13, 0.2);
const MUTED = rgb(0.4, 0.44, 0.52);
const LINE = rgb(0.86, 0.89, 0.93);
const PRIMARY = rgb(0.21, 0.35, 0.89);
const PALE = rgb(0.96, 0.97, 0.99);

interface PdfFonts {
  regular: PDFFont;
  bold: PDFFont;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }

    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);

      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        line = word;
        continue;
      }

      let fragment = "";
      for (const character of word) {
        const candidateFragment = `${fragment}${character}`;
        if (
          font.widthOfTextAtSize(candidateFragment, size) > maxWidth &&
          fragment
        ) {
          lines.push(fragment);
          fragment = character;
        } else {
          fragment = candidateFragment;
        }
      }
      line = fragment;
    }
    if (line) lines.push(line);
  }

  return lines;
}

function addBasePage(document: PDFDocument) {
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: rgb(1, 1, 1),
  });
  return page;
}

function drawBrand(page: PDFPage, fonts: PdfFonts) {
  page.drawText("feedy", {
    x: MARGIN,
    y: PAGE_HEIGHT - MARGIN + 3,
    size: 18,
    font: fonts.bold,
    color: PRIMARY,
  });
}

function drawLabel(
  page: PDFPage,
  fonts: PdfFonts,
  label: string,
  value: string,
  y: number,
) {
  page.drawText(label.toUpperCase(), {
    x: MARGIN,
    y,
    size: 8,
    font: fonts.bold,
    color: MUTED,
  });
  page.drawText(value, {
    x: MARGIN + 118,
    y: y - 1,
    size: 10.5,
    font: fonts.regular,
    color: INK,
  });
}

function drawRecordHeader(
  page: PDFPage,
  fonts: PdfFonts,
  record: FeedbackExportRecord,
  index: number,
  total: number,
  continued = false,
) {
  drawBrand(page, fonts);
  page.drawText(continued ? "Feedback (continued)" : "Feedback record", {
    x: MARGIN,
    y: PAGE_HEIGHT - 89,
    size: 21,
    font: fonts.bold,
    color: INK,
  });
  page.drawText(`Feedback ${index + 1} of ${total}`, {
    x: PAGE_WIDTH - MARGIN - 88,
    y: PAGE_HEIGHT - 84,
    size: 9,
    font: fonts.bold,
    color: PRIMARY,
  });
  page.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT - 106 },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 106 },
    thickness: 1,
    color: LINE,
  });
  drawLabel(page, fonts, "Project", record.projectName, PAGE_HEIGHT - 132);
  drawLabel(page, fonts, "Version", record.projectVersion, PAGE_HEIGHT - 153);
  return PAGE_HEIGHT - 180;
}

function drawDescription(
  document: PDFDocument,
  page: PDFPage,
  fonts: PdfFonts,
  record: FeedbackExportRecord,
  initialY: number,
  index: number,
  total: number,
) {
  const lines = wrapText(
    record.description,
    fonts.regular,
    10.5,
    CONTENT_WIDTH - 24,
  );
  const remaining = [...lines];
  let y = initialY;
  let continued = false;

  while (remaining.length) {
    const availableLineCount = Math.max(1, Math.floor((y - 116) / 15));
    const chunk = remaining.splice(0, availableLineCount);
    const boxHeight = Math.max(58, chunk.length * 15 + 28);

    page.drawText(continued ? "DESCRIPTION (CONTINUED)" : "DESCRIPTION", {
      x: MARGIN,
      y,
      size: 8,
      font: fonts.bold,
      color: MUTED,
    });
    page.drawRectangle({
      x: MARGIN,
      y: y - boxHeight - 13,
      width: CONTENT_WIDTH,
      height: boxHeight,
      color: PALE,
      borderColor: LINE,
      borderWidth: 0.8,
    });
    let textY = y - 34;
    for (const line of chunk) {
      page.drawText(line || " ", {
        x: MARGIN + 12,
        y: textY,
        size: 10.5,
        font: fonts.regular,
        color: INK,
      });
      textY -= 15;
    }
    y -= boxHeight + 33;

    if (remaining.length) {
      page = addBasePage(document);
      y = drawRecordHeader(page, fonts, record, index, total, true);
      continued = true;
    }
  }

  return { page, y };
}

async function normalizeForPdf(bytes: Uint8Array) {
  return sharp(bytes)
    .rotate()
    .resize({
      width: 1500,
      height: 1200,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

async function drawRecord(
  document: PDFDocument,
  fonts: PdfFonts,
  record: FeedbackExportRecord,
  index: number,
  total: number,
) {
  let page = addBasePage(document);
  let y = drawRecordHeader(page, fonts, record, index, total);
  const descriptionResult = drawDescription(
    document,
    page,
    fonts,
    record,
    y,
    index,
    total,
  );
  page = descriptionResult.page;
  y = descriptionResult.y;

  if (y < 105) {
    page = addBasePage(document);
    y = drawRecordHeader(page, fonts, record, index, total, true);
  }

  drawLabel(page, fonts, "Created", formatDate(record.createdAt), y);
  drawLabel(page, fonts, "Updated", formatDate(record.updatedAt), y - 21);
  y -= 58;

  page.drawText("PHOTOS", {
    x: MARGIN,
    y,
    size: 8,
    font: fonts.bold,
    color: MUTED,
  });
  y -= 20;

  if (record.photoBytes.length === 0) {
    page.drawText("No photos attached", {
      x: MARGIN,
      y: y - 10,
      size: 10.5,
      font: fonts.regular,
      color: MUTED,
    });
    return;
  }

  for (const photo of record.photoBytes) {
    const normalized = await normalizeForPdf(photo.bytes);
    const embedded = await document.embedJpg(normalized);
    const availableHeight = 300;
    const scale = Math.min(
      CONTENT_WIDTH / embedded.width,
      availableHeight / embedded.height,
      1,
    );
    const width = embedded.width * scale;
    const height = embedded.height * scale;

    if (y - height - 34 < 54) {
      page = addBasePage(document);
      y = drawRecordHeader(page, fonts, record, index, total, true) - 10;
    }

    page.drawRectangle({
      x: MARGIN,
      y: y - height - 8,
      width: CONTENT_WIDTH,
      height: height + 16,
      color: PALE,
      borderColor: LINE,
      borderWidth: 0.8,
    });
    page.drawImage(embedded, {
      x: MARGIN + (CONTENT_WIDTH - width) / 2,
      y: y - height,
      width,
      height,
    });
    y -= height + 22;
    page.drawText(photo.originalFilename, {
      x: MARGIN,
      y,
      size: 9,
      font: fonts.regular,
      color: MUTED,
    });
    y -= 28;
  }
}

function drawCover(
  document: PDFDocument,
  fonts: PdfFonts,
  records: FeedbackExportRecord[],
  generatedAt: Date,
) {
  const page = addBasePage(document);
  drawBrand(page, fonts);
  page.drawText("Feedback export", {
    x: MARGIN,
    y: PAGE_HEIGHT - 160,
    size: 32,
    font: fonts.bold,
    color: INK,
  });
  page.drawText("A structured record of selected project feedback.", {
    x: MARGIN,
    y: PAGE_HEIGHT - 190,
    size: 12,
    font: fonts.regular,
    color: MUTED,
  });
  const projectCount = new Set(records.map((record) => record.projectId)).size;
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_HEIGHT - 294,
    width: CONTENT_WIDTH,
    height: 72,
    color: PALE,
    borderColor: LINE,
    borderWidth: 0.8,
  });
  page.drawText(String(records.length), {
    x: MARGIN + 18,
    y: PAGE_HEIGHT - 260,
    size: 22,
    font: fonts.bold,
    color: INK,
  });
  page.drawText("feedback items", {
    x: MARGIN + 18,
    y: PAGE_HEIGHT - 278,
    size: 9,
    font: fonts.regular,
    color: MUTED,
  });
  page.drawText(String(projectCount), {
    x: MARGIN + 178,
    y: PAGE_HEIGHT - 260,
    size: 22,
    font: fonts.bold,
    color: INK,
  });
  page.drawText("projects", {
    x: MARGIN + 178,
    y: PAGE_HEIGHT - 278,
    size: 9,
    font: fonts.regular,
    color: MUTED,
  });
  page.drawText(`Generated ${formatDate(generatedAt.toISOString())}`, {
    x: MARGIN,
    y: 70,
    size: 9,
    font: fonts.regular,
    color: MUTED,
  });
}

function drawContents(
  document: PDFDocument,
  fonts: PdfFonts,
  records: FeedbackExportRecord[],
) {
  let page = addBasePage(document);
  drawBrand(page, fonts);
  page.drawText("Contents", {
    x: MARGIN,
    y: PAGE_HEIGHT - 90,
    size: 22,
    font: fonts.bold,
    color: INK,
  });
  let y = PAGE_HEIGHT - 130;

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (y < 70) {
      page = addBasePage(document);
      drawBrand(page, fonts);
      page.drawText("Contents (continued)", {
        x: MARGIN,
        y: PAGE_HEIGHT - 90,
        size: 22,
        font: fonts.bold,
        color: INK,
      });
      y = PAGE_HEIGHT - 130;
    }
    page.drawText(String(index + 1).padStart(2, "0"), {
      x: MARGIN,
      y,
      size: 9,
      font: fonts.bold,
      color: PRIMARY,
    });
    page.drawText(record.projectName, {
      x: MARGIN + 34,
      y,
      size: 10,
      font: fonts.bold,
      color: INK,
    });
    page.drawText(`Version ${record.projectVersion}`, {
      x: MARGIN + 255,
      y,
      size: 9,
      font: fonts.regular,
      color: MUTED,
    });
    page.drawLine({
      start: { x: MARGIN, y: y - 12 },
      end: { x: PAGE_WIDTH - MARGIN, y: y - 12 },
      thickness: 0.6,
      color: LINE,
    });
    y -= 34;
  }
}

export async function createFeedbackPdf(
  records: FeedbackExportRecord[],
  generatedAt = new Date(),
) {
  if (records.length === 0)
    throw new Error("At least one feedback record is required.");

  const document = await PDFDocument.create();
  const fonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
  };
  document.setTitle(
    records.length === 1 ? "Feedy feedback record" : "Feedy feedback export",
  );
  document.setAuthor("Feedy");
  document.setCreator("Feedy");
  document.setCreationDate(generatedAt);

  if (records.length > 1) {
    drawCover(document, fonts, records, generatedAt);
    drawContents(document, fonts, records);
  }

  for (let index = 0; index < records.length; index += 1) {
    await drawRecord(document, fonts, records[index], index, records.length);
  }

  const pages = document.getPages();
  pages.forEach((page, index) => {
    const footer = `Generated ${generatedAt.toISOString().slice(0, 10)}  •  Page ${index + 1} of ${pages.length}`;
    const width = fonts.regular.widthOfTextAtSize(footer, 8);
    page.drawText(footer, {
      x: PAGE_WIDTH - MARGIN - width,
      y: FOOTER_Y,
      size: 8,
      font: fonts.regular,
      color: MUTED,
    });
  });

  return document.save();
}
