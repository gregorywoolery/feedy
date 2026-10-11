// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/application", () => ({
  createProject: vi.fn().mockResolvedValue({ id: "project" }),
  deleteProject: vi
    .fn()
    .mockResolvedValue({ deletedFeedbackCount: 0, cleanupPending: 0 }),
  createFeedback: vi.fn(),
  updateFeedback: vi.fn(),
  deleteFeedback: vi.fn(),
  exportFeedback: vi.fn(),
}));
import * as application from "@/server/application";
import { POST as createProject } from "@/app/api/projects/route";
import { DELETE as deleteProject } from "@/app/api/projects/[id]/route";
import {
  POST as createFeedback,
  DELETE as deleteFeedback,
} from "@/app/api/feedback/route";
import { PATCH as updateFeedback } from "@/app/api/feedback/[id]/route";
import { POST as exportFeedback } from "@/app/api/feedback/export/route";

const context = {
  params: Promise.resolve({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
};
const projectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const photoId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function jsonRequest(body: unknown, method = "POST") {
  return new Request("http://localhost:3000/api/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function feedbackForm() {
  const form = new FormData();
  form.set("projectId", projectId);
  form.set("projectVersion", "  v2  ");
  form.set("description", "  Updated feedback  ");
  form.set("photoOrder", "[]");
  return form;
}

function multipartRequest(form: FormData, method = "POST") {
  return new Request("http://localhost:3000/api/feedback", {
    method,
    body: form,
  });
}

beforeEach(() => vi.clearAllMocks());

describe("route security integration", () => {
  it("blocks every browser mutation before invoking application code", async () => {
    for (const [method, handler] of [
      ["POST", createProject],
      ["POST", createFeedback],
      ["DELETE", deleteFeedback],
      ["PATCH", updateFeedback],
      ["DELETE", deleteProject],
      ["POST", exportFeedback],
    ] as const) {
      const request = new Request("http://localhost:3000/api/test", {
        method,
        headers: { origin: "https://evil.example" },
      });
      expect((await handler(request, context)).status).toBe(403);
    }
    for (const handler of Object.values(application))
      expect(handler).not.toHaveBeenCalled();
  });
  it("preserves JSON project creation and bodyless project deletion", async () => {
    const input = { name: "Normal project", description: "Feedback" };
    const request = new Request("http://localhost:3000/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify(input),
    });
    expect((await createProject(request)).status).toBe(201);
    expect(application.createProject).toHaveBeenCalledWith(input);
    expect(
      (
        await deleteProject(
          new Request("http://localhost:3000/api/projects/id", {
            method: "DELETE",
          }),
          context,
        )
      ).status,
    ).toBe(200);
  });
  it("rejects a declared oversized upload before application side effects", async () => {
    const request = new Request("http://localhost:3000/api/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data; boundary=x",
        "Content-Length": String(56 * 1024 * 1024),
      },
      body: "x",
    });
    expect((await createFeedback(request)).status).toBe(413);
    expect(application.createFeedback).not.toHaveBeenCalled();
  });
});

describe("route input validation", () => {
  it("normalizes project input before calling the application", async () => {
    const response = await createProject(
      jsonRequest({ name: "  Project  ", ignored: "extra field" }),
    );
    expect(response.status).toBe(201);
    expect(application.createProject).toHaveBeenCalledWith({
      name: "Project",
      description: null,
    });
  });

  it.each([{ name: "   " }, { name: 123 }])(
    "rejects invalid project input before application code: %j",
    async (input) => {
      const response = await createProject(jsonRequest(input));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: {
          code: "VALIDATION_ERROR",
          fields: { name: expect.any(Array) },
        },
      });
      expect(application.createProject).not.toHaveBeenCalled();
    },
  );

  it("validates the project ID before deletion", async () => {
    const response = await deleteProject(
      new Request("http://localhost:3000/api/projects/invalid", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "invalid" }) },
    );
    expect(response.status).toBe(400);
    expect(application.deleteProject).not.toHaveBeenCalled();
  });

  it("passes normalized feedback fields and actual files to the application", async () => {
    vi.mocked(application.createFeedback).mockResolvedValue(null);
    const form = feedbackForm();
    form.append(
      "photos",
      new File(["image"], "photo.png", { type: "image/png" }),
    );
    const response = await createFeedback(multipartRequest(form));
    expect(response.status).toBe(201);
    expect(application.createFeedback).toHaveBeenCalledWith({
      projectId,
      projectVersion: "v2",
      description: "Updated feedback",
      photos: [expect.any(File)],
    });
  });

  it.each([
    ["projectId", "invalid"],
    ["projectVersion", "   "],
    ["description", ""],
  ])("rejects an invalid feedback field: %s", async (field, value) => {
    const form = feedbackForm();
    form.set(field, value);
    const response = await createFeedback(multipartRequest(form));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        fields: { [field]: expect.any(Array) },
      },
    });
    expect(application.createFeedback).not.toHaveBeenCalled();
  });

  it("validates and decodes photo edits before calling the application", async () => {
    vi.mocked(application.updateFeedback).mockResolvedValue(null);
    const form = feedbackForm();
    form.set("photoOrder", JSON.stringify([{ kind: "new", id: photoId }]));
    form.append("newPhotoIds", photoId);
    form.append(
      "newPhotos",
      new File(["image"], "photo.png", { type: "image/png" }),
    );
    const response = await updateFeedback(
      multipartRequest(form, "PATCH"),
      context,
    );
    expect(response.status).toBe(200);
    expect(application.updateFeedback).toHaveBeenCalledWith({
      feedbackId: projectId,
      projectVersion: "v2",
      description: "Updated feedback",
      photoOrder: [{ kind: "new", id: photoId }],
      newPhotoIds: [photoId],
      newPhotos: [expect.any(File)],
    });
  });

  it.each([
    ["projectVersion", ""],
    ["photoOrder", JSON.stringify([{ kind: "other", id: photoId }])],
    ["photoOrder", JSON.stringify([{ kind: "new", id: "invalid" }])],
    ["newPhotoIds", "invalid"],
  ])("rejects invalid edit input: %s = %s", async (field, value) => {
    const form = feedbackForm();
    form.set(field, value);
    const response = await updateFeedback(
      multipartRequest(form, "PATCH"),
      context,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
    expect(application.updateFeedback).not.toHaveBeenCalled();
  });

  it("rejects a duplicate photo order before application code", async () => {
    const form = feedbackForm();
    form.set(
      "photoOrder",
      JSON.stringify([
        { kind: "existing", id: photoId },
        { kind: "new", id: photoId },
      ]),
    );
    const response = await updateFeedback(
      multipartRequest(form, "PATCH"),
      context,
    );
    expect(response.status).toBe(400);
    expect(application.updateFeedback).not.toHaveBeenCalled();
  });

  it("validates the feedback ID before an edit", async () => {
    const response = await updateFeedback(
      multipartRequest(feedbackForm(), "PATCH"),
      {
        params: Promise.resolve({ id: "invalid" }),
      },
    );
    expect(response.status).toBe(400);
    expect(application.updateFeedback).not.toHaveBeenCalled();
  });

  it("preserves the error response for malformed photo-order JSON", async () => {
    const form = feedbackForm();
    form.set("photoOrder", "{");
    const response = await updateFeedback(
      multipartRequest(form, "PATCH"),
      context,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "INVALID_PHOTO_ORDER" },
    });
    expect(application.updateFeedback).not.toHaveBeenCalled();
  });

  it("rejects text submitted as a new photo", async () => {
    const form = feedbackForm();
    form.set("newPhotos", "not a file");
    const response = await updateFeedback(
      multipartRequest(form, "PATCH"),
      context,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "PHOTO_VALIDATION_ERROR" },
    });
    expect(application.updateFeedback).not.toHaveBeenCalled();
  });

  it("rejects duplicate deletion IDs before application code", async () => {
    const response = await deleteFeedback(
      jsonRequest({ ids: [projectId, projectId] }, "DELETE"),
    );
    expect(response.status).toBe(400);
    expect(application.deleteFeedback).not.toHaveBeenCalled();
  });

  it.each([{ ids: ["invalid"] }, { query: { hasPhotos: "sometimes" } }])(
    "rejects invalid export input before application code: %j",
    async (input) => {
      const response = await exportFeedback(jsonRequest(input));
      expect(response.status).toBe(400);
      expect(application.exportFeedback).not.toHaveBeenCalled();
    },
  );

  it("applies filtered export defaults before application code", async () => {
    vi.mocked(application.exportFeedback).mockResolvedValue({
      pdf: new Uint8Array([1]),
      filename: "test.pdf",
    });
    const response = await exportFeedback(
      jsonRequest({ query: { project: projectId } }),
    );
    expect(response.status).toBe(200);
    expect(application.exportFeedback).toHaveBeenCalledWith({
      query: {
        project: projectId,
        q: "",
        version: "",
        hasPhotos: "all",
        from: "",
        to: "",
        sort: "createdAt",
        order: "desc",
      },
    });
  });
});
