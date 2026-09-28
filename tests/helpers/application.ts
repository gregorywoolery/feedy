import { vi } from "vitest";
import type { ApplicationDependencies } from "@/use-cases/ports";

export function testDependencies(): ApplicationDependencies {
  return {
    feedback: {
      createFeedbackRecord: vi.fn(),
      updateFeedbackRecord: vi.fn(),
      deleteFeedbackRecords: vi.fn(),
      getFeedbackById: vi.fn(),
      getFeedbackBatch: vi.fn(),
      getPhotoStorageRecord: vi.fn(),
      listPhotoStorageRecords: vi.fn(),
      listFeedback: vi.fn(),
      listFeedbackIds: vi.fn(),
      getFeedbackSummary: vi.fn(),
      listFeedbackVersions: vi.fn(),
    },
    projects: {
      createProject: vi.fn(),
      projectExists: vi.fn(),
      deleteProjectRecord: vi.fn(),
      getProjectById: vi.fn(),
      listProjectOptions: vi.fn(),
      listProjects: vi.fn(),
    },
    storage: { namespace: "test", put: vi.fn(), get: vi.fn(), delete: vi.fn() },
    normalizePhotos: vi.fn(),
    cleanupPhotos: vi.fn().mockResolvedValue(0),
    renderPdf: vi.fn(),
  };
}
