import { z } from "zod";

import type { FeedbackQuery } from "@/entities/contracts/feedback";
import { MAX_PHOTO_COUNT } from "@/lib/validation/photo-limits";

const feedbackTextFields = {
  projectVersion: z
    .string()
    .trim()
    .min(1, "Enter the project version you reviewed.")
    .max(80, "Project versions must be 80 characters or fewer."),
  description: z
    .string()
    .trim()
    .min(1, "Describe the feedback.")
    .max(10000, "Feedback descriptions must be 10,000 characters or fewer."),
};

export const createFeedbackFieldsSchema = z.object({
  projectId: z.string().uuid("Choose a valid project."),
  ...feedbackTextFields,
});

export const updateFeedbackFieldsSchema = z.object(feedbackTextFields);
export const updateFeedbackNewPhotoIdsSchema = z.array(z.string().uuid());
export const updateFeedbackPhotoOrderSchema = z
  .array(
    z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("existing"), id: z.string().uuid() }),
      z.object({ kind: z.literal("new"), id: z.string().uuid() }),
    ]),
  )
  .max(MAX_PHOTO_COUNT)
  .superRefine((items, context) => {
    if (new Set(items.map((item) => item.id)).size !== items.length) {
      context.addIssue({
        code: "custom",
        message: "Duplicate photos are not allowed.",
      });
    }
  });

export const feedbackIdSchema = z.string().uuid();

function uniqueIdsSchema(maximum: number) {
  return z
    .array(feedbackIdSchema)
    .min(1)
    .max(maximum)
    .superRefine((ids, context) => {
      if (new Set(ids).size !== ids.length) {
        context.addIssue({
          code: "custom",
          message: "Duplicate feedback IDs are not allowed.",
        });
      }
    });
}

export const batchExportSchema = z.object({ ids: uniqueIdsSchema(100) });
export const deleteFeedbackSchema = z.object({ ids: uniqueIdsSchema(100) });

const sortValues = new Set(["createdAt", "updatedAt", "project", "version"]);
const orderValues = new Set(["asc", "desc"]);
const photoValues = new Set(["all", "yes", "no"]);
const pageSizes = new Set([10, 25, 50, 100]);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

type SearchInput = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function validDate(value: string) {
  if (!datePattern.test(value)) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) ||
    date.toISOString().slice(0, 10) !== value
    ? ""
    : value;
}

function positiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseFeedbackQuery(input: SearchInput): FeedbackQuery {
  const rawSort = firstValue(input.sort);
  const rawOrder = firstValue(input.order);
  const rawHasPhotos = firstValue(input.hasPhotos);
  const requestedPageSize = positiveInteger(firstValue(input.pageSize), 25);
  const project = firstValue(input.project);

  return {
    q: firstValue(input.q).trim().slice(0, 200),
    project: z.string().uuid().safeParse(project).success ? project : "",
    version: firstValue(input.version).trim().slice(0, 80),
    hasPhotos: photoValues.has(rawHasPhotos)
      ? (rawHasPhotos as FeedbackQuery["hasPhotos"])
      : "all",
    from: validDate(firstValue(input.from)),
    to: validDate(firstValue(input.to)),
    sort: sortValues.has(rawSort)
      ? (rawSort as FeedbackQuery["sort"])
      : "createdAt",
    order: orderValues.has(rawOrder)
      ? (rawOrder as FeedbackQuery["order"])
      : "desc",
    page: positiveInteger(firstValue(input.page), 1),
    pageSize: pageSizes.has(requestedPageSize)
      ? (requestedPageSize as FeedbackQuery["pageSize"])
      : 25,
  };
}

const filteredExportQuerySchema = z.object({
  q: z.string().max(200).default(""),
  project: z.union([z.literal(""), z.string().uuid()]).default(""),
  version: z.string().max(80).default(""),
  hasPhotos: z.enum(["all", "yes", "no"]).default("all"),
  from: z.string().regex(datePattern).or(z.literal("")).default(""),
  to: z.string().regex(datePattern).or(z.literal("")).default(""),
  sort: z
    .enum(["createdAt", "updatedAt", "project", "version"])
    .default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const exportFeedbackSchema = z.union([
  batchExportSchema,
  z.object({ query: filteredExportQuerySchema }),
]);

export type CreateFeedbackFields = z.infer<typeof createFeedbackFieldsSchema>;
export type UpdateFeedbackFields = z.infer<typeof updateFeedbackFieldsSchema>;
export type UpdateFeedbackPhotoOrder = z.infer<
  typeof updateFeedbackPhotoOrderSchema
>;
export type DeleteFeedbackInput = z.infer<typeof deleteFeedbackSchema>;
export type ExportFeedbackInput = z.infer<typeof exportFeedbackSchema>;
