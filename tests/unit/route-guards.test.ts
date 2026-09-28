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
