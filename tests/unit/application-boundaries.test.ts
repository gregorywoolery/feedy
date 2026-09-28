// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { testDependencies } from "../helpers/application";
import { createFeedbackUseCase } from "@/use-cases/feedback/create-feedback";
import { getExportRecords } from "@/use-cases/exports/get-export-records";
import {
  MAX_EXPORT_BYTES,
  ExportLimitError,
} from "@/use-cases/exports/export-limits";
import { withExportCapacity } from "@/server/export-capacity";

const projectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const photo = {
  bytes: new Uint8Array([1]),
  originalFilename: "test.png",
  mimeType: "image/png" as const,
  sizeBytes: 1,
  width: 1,
  height: 1,
};
const record = {
  id: "feedback",
  projectId,
  projectName: "Project",
  projectVersion: "1",
  description: "Feedback",
  photos: [],
  photoCount: 0,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("application boundaries", () => {
  it("compensates saved bytes when the metadata transaction fails", async () => {
    const deps = testDependencies();
    vi.mocked(deps.projects.projectExists).mockResolvedValue(true);
    vi.mocked(deps.normalizePhotos).mockResolvedValue([photo]);
    vi.mocked(deps.storage.put).mockResolvedValue({ key: "saved.png" });
    vi.mocked(deps.feedback.createFeedbackRecord).mockRejectedValue(
      new Error("database unavailable"),
    );
    await expect(
      createFeedbackUseCase(
        { projectId, projectVersion: "1", description: "Test", photos: [] },
        deps,
      ),
    ).rejects.toThrow("database unavailable");
    expect(deps.cleanupPhotos).toHaveBeenCalledWith(["saved.png"]);
    expect(deps.feedback.createFeedbackRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        photos: [expect.not.objectContaining({ bytes: expect.anything() })],
      }),
    );
  });
  it("does not remove committed photos when readback fails", async () => {
    const deps = testDependencies();
    vi.mocked(deps.projects.projectExists).mockResolvedValue(true);
    vi.mocked(deps.normalizePhotos).mockResolvedValue([photo]);
    vi.mocked(deps.storage.put).mockResolvedValue({ key: "saved.png" });
    vi.mocked(deps.feedback.createFeedbackRecord).mockResolvedValue("feedback");
    vi.mocked(deps.feedback.getFeedbackById).mockRejectedValue(
      new Error("read unavailable"),
    );
    await expect(
      createFeedbackUseCase(
        { projectId, projectVersion: "1", description: "Test", photos: [] },
        deps,
      ),
    ).rejects.toThrow("read unavailable");
    expect(deps.cleanupPhotos).not.toHaveBeenCalled();
  });
  it("rejects export metadata over budget without reading photo bytes", async () => {
    const deps = testDependencies();
    vi.mocked(deps.feedback.getFeedbackBatch).mockResolvedValue([record]);
    vi.mocked(deps.feedback.listPhotoStorageRecords).mockResolvedValue([
      {
        id: "photo",
        feedbackId: record.id,
        storageKey: "key",
        originalFilename: "x.png",
        mimeType: "image/png",
        sizeBytes: MAX_EXPORT_BYTES + 1,
      },
    ]);
    await expect(getExportRecords([record.id], deps)).rejects.toBeInstanceOf(
      ExportLimitError,
    );
    expect(deps.storage.get).not.toHaveBeenCalled();
  });
  it("accepts a small photo export and checks actual bytes against the budget", async () => {
    const deps = testDependencies();
    const metadata = {
      id: "photo",
      originalFilename: "x.png",
      mimeType: "image/png" as const,
      sizeBytes: 1,
      width: 1,
      height: 1,
      sortOrder: 0,
    };
    vi.mocked(deps.feedback.getFeedbackBatch).mockResolvedValue([
      { ...record, photos: [metadata] },
    ]);
    vi.mocked(deps.feedback.listPhotoStorageRecords).mockResolvedValue([
      { ...metadata, feedbackId: record.id, storageKey: "key" },
    ]);
    vi.mocked(deps.storage.get).mockResolvedValue({
      bytes: new Uint8Array([1]),
      mimeType: "image/png",
    });
    expect(
      (await getExportRecords([record.id], deps))[0].photoBytes,
    ).toHaveLength(1);
    vi.mocked(deps.storage.get).mockResolvedValue({
      bytes: new Uint8Array(MAX_EXPORT_BYTES + 1),
      mimeType: "image/png",
    });
    await expect(getExportRecords([record.id], deps)).rejects.toBeInstanceOf(
      ExportLimitError,
    );
  });
  it("holds export admission during reads and releases it after failure", async () => {
    let finish!: () => void;
    const wait = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const running = withExportCapacity(() => wait);
    await expect(withExportCapacity(async () => 2)).rejects.toThrow(
      "Another PDF",
    );
    finish();
    await running;
    await expect(
      withExportCapacity(async () => {
        throw new Error("render failed");
      }),
    ).rejects.toThrow("render failed");
    await expect(withExportCapacity(async () => 3)).resolves.toBe(3);
  });
});
