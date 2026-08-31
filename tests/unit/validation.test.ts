import { describe, expect, it } from "vitest";

import {
  batchExportSchema,
  createFeedbackFieldsSchema,
  deleteFeedbackSchema,
  exportFeedbackSchema,
  feedbackIdSchema,
  parseFeedbackQuery,
} from "@/lib/validation/feedback";
import { createProjectSchema } from "@/lib/validation/projects";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const FEEDBACK_ID = "22222222-2222-4222-8222-222222222222";

describe("parseFeedbackQuery", () => {
  it("returns stable dashboard defaults for an empty query", () => {
    expect(parseFeedbackQuery({})).toEqual({
      q: "",
      project: "",
      version: "",
      hasPhotos: "all",
      from: "",
      to: "",
      sort: "createdAt",
      order: "desc",
      page: 1,
      pageSize: 25,
    });
  });

  it("parses every supported filter and uses the first repeated value", () => {
    expect(
      parseFeedbackQuery({
        q: ["  checkout regression  ", "ignored"],
        project: PROJECT_ID,
        version: "  2.4.0-rc.1  ",
        hasPhotos: "yes",
        from: "2024-02-29",
        to: "2026-08-30",
        sort: "project",
        order: "asc",
        page: "3",
        pageSize: "50",
      }),
    ).toEqual({
      q: "checkout regression",
      project: PROJECT_ID,
      version: "2.4.0-rc.1",
      hasPhotos: "yes",
      from: "2024-02-29",
      to: "2026-08-30",
      sort: "project",
      order: "asc",
      page: 3,
      pageSize: 50,
    });
  });

  it("falls back safely for invalid enums, IDs, dates, and pagination", () => {
    expect(
      parseFeedbackQuery({
        project: "not-a-project-id",
        hasPhotos: "sometimes",
        from: "2023-02-29",
        to: "30-08-2026",
        sort: "description",
        order: "sideways",
        page: "0",
        pageSize: "75",
      }),
    ).toMatchObject({
      project: "",
      hasPhotos: "all",
      from: "",
      to: "",
      sort: "createdAt",
      order: "desc",
      page: 1,
      pageSize: 25,
    });
  });

  it("bounds free-text filters before passing them to the repository", () => {
    const parsed = parseFeedbackQuery({
      q: `  ${"q".repeat(240)}  `,
      version: `  ${"v".repeat(100)}  `,
    });

    expect(parsed.q).toHaveLength(200);
    expect(parsed.version).toHaveLength(80);
  });
});

describe("project validation", () => {
  it("trims project fields and normalizes an omitted or blank description", () => {
    expect(
      createProjectSchema.parse({
        name: "  Mobile redesign  ",
        description: "  Customer-facing refresh  ",
      }),
    ).toEqual({
      name: "Mobile redesign",
      description: "Customer-facing refresh",
    });
    expect(createProjectSchema.parse({ name: "API" })).toEqual({
      name: "API",
      description: null,
    });
    expect(
      createProjectSchema.parse({ name: "API", description: "   " }),
    ).toEqual({ name: "API", description: null });
  });

  it("rejects missing and over-limit project fields", () => {
    expect(createProjectSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(
      createProjectSchema.safeParse({ name: "n".repeat(161) }).success,
    ).toBe(false);
    expect(
      createProjectSchema.safeParse({
        name: "Valid",
        description: "d".repeat(4001),
      }).success,
    ).toBe(false);
  });
});

describe("feedback validation", () => {
  it("accepts a valid feedback record and trims its text fields", () => {
    expect(
      createFeedbackFieldsSchema.parse({
        projectId: PROJECT_ID,
        projectVersion: "  v3.2.1  ",
        description: "  The upload state needs a clearer label.  ",
      }),
    ).toEqual({
      projectId: PROJECT_ID,
      projectVersion: "v3.2.1",
      description: "The upload state needs a clearer label.",
    });
    expect(feedbackIdSchema.parse(FEEDBACK_ID)).toBe(FEEDBACK_ID);
  });

  it("rejects invalid IDs, empty content, and text over the field limits", () => {
    expect(
      createFeedbackFieldsSchema.safeParse({
        projectId: "invalid",
        projectVersion: "",
        description: "",
      }).success,
    ).toBe(false);
    expect(
      createFeedbackFieldsSchema.safeParse({
        projectId: PROJECT_ID,
        projectVersion: "v".repeat(81),
        description: "Useful feedback",
      }).success,
    ).toBe(false);
    expect(
      createFeedbackFieldsSchema.safeParse({
        projectId: PROJECT_ID,
        projectVersion: "1.0",
        description: "d".repeat(10_001),
      }).success,
    ).toBe(false);
    expect(feedbackIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});

describe("batch export validation", () => {
  it("accepts one or more unique feedback IDs", () => {
    expect(
      batchExportSchema.parse({ ids: [PROJECT_ID, FEEDBACK_ID] }),
    ).toEqual({ ids: [PROJECT_ID, FEEDBACK_ID] });
  });

  it("rejects duplicates, empty batches, malformed IDs, and more than 100 IDs", () => {
    const duplicate = batchExportSchema.safeParse({
      ids: [FEEDBACK_ID, FEEDBACK_ID],
    });

    expect(duplicate.success).toBe(false);
    if (!duplicate.success) {
      expect(duplicate.error.issues).toContainEqual(
        expect.objectContaining({
          path: ["ids"],
          message: "Duplicate feedback IDs are not allowed.",
        }),
      );
    }
    expect(batchExportSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(batchExportSchema.safeParse({ ids: ["invalid"] }).success).toBe(
      false,
    );
    expect(
      batchExportSchema.safeParse({
        ids: Array.from(
          { length: 101 },
          (_, index) =>
            `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        ),
      }).success,
    ).toBe(false);
  });

  it("accepts filtered exports and deletion batches while rejecting duplicate deletes", () => {
    expect(
      exportFeedbackSchema.parse({
        query: {
          project: PROJECT_ID,
          version: "v2",
          hasPhotos: "yes",
          q: "checkout",
          from: "2026-08-01",
          to: "2026-08-30",
          sort: "version",
          order: "asc",
        },
      }),
    ).toMatchObject({ query: { project: PROJECT_ID, version: "v2" } });
    expect(deleteFeedbackSchema.parse({ ids: [FEEDBACK_ID] })).toEqual({
      ids: [FEEDBACK_ID],
    });
    expect(
      deleteFeedbackSchema.safeParse({ ids: [FEEDBACK_ID, FEEDBACK_ID] }).success,
    ).toBe(false);
  });
});
