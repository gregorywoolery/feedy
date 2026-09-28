import type {
  FeedbackDataRecord,
  FeedbackDataPage,
} from "@/entities/feedback-data";
import type {
  FeedbackExportRecord,
  FeedbackQuery,
  FeedbackSummary,
} from "@/entities/contracts/feedback";
import type {
  ProjectOption,
  ProjectRecord,
} from "@/entities/contracts/project";
import type { NormalizedPhoto, StoredPhotoInput } from "@/entities/photos";
import type { PhotoStorage } from "@/entities/photo-storage";

export interface PhotoStorageRecord {
  id: string;
  storageKey: string;
  mimeType: string;
  originalFilename: string;
}

export interface ExportPhotoStorageRecord extends PhotoStorageRecord {
  feedbackId: string;
  sizeBytes: number;
}

export interface FeedbackRepository {
  createFeedbackRecord(input: {
    projectId: string;
    projectVersion: string;
    description: string;
    photos: StoredPhotoInput[];
  }): Promise<string>;
  updateFeedbackRecord(input: {
    feedbackId: string;
    projectVersion: string;
    description: string;
    expectedPhotoIds: string[];
    retainedPhotos: Array<{ id: string; sortOrder: number }>;
    newPhotos: StoredPhotoInput[];
    storageNamespace: string;
  }): Promise<{ removedStorageKeys: string[] } | null>;
  deleteFeedbackRecords(
    ids: string[],
    storageNamespace: string,
  ): Promise<{ deletedIds: string[]; storageKeys: string[] }>;
  getFeedbackById(id: string): Promise<FeedbackDataRecord | null>;
  getFeedbackBatch(ids: string[]): Promise<FeedbackDataRecord[]>;
  getPhotoStorageRecord(id: string): Promise<PhotoStorageRecord | null>;
  listPhotoStorageRecords(ids: string[]): Promise<ExportPhotoStorageRecord[]>;
  listFeedback(query: FeedbackQuery): Promise<FeedbackDataPage>;
  listFeedbackIds(
    query: FeedbackQuery,
    maximum: number,
  ): Promise<{ ids: string[]; exceedsMaximum: boolean }>;
  getFeedbackSummary(): Promise<FeedbackSummary>;
  listFeedbackVersions(projectId?: string): Promise<string[]>;
}

export interface ProjectRepository {
  createProject(input: {
    name: string;
    description: string | null;
  }): Promise<ProjectRecord>;
  projectExists(id: string): Promise<boolean>;
  deleteProjectRecord(
    id: string,
    storageNamespace: string,
  ): Promise<{
    deleted: boolean;
    feedbackCount: number;
    storageKeys: string[];
  }>;
  getProjectById(id: string): Promise<ProjectRecord | null>;
  listProjectOptions(): Promise<ProjectOption[]>;
  listProjects(): Promise<ProjectRecord[]>;
}

/** Explicit dependencies keep use cases testable without loading a database or Sharp. */
export interface ApplicationDependencies {
  feedback: FeedbackRepository;
  projects: ProjectRepository;
  storage: PhotoStorage;
  normalizePhotos(files: File[]): Promise<NormalizedPhoto[]>;
  cleanupPhotos(keys: string[]): Promise<number>;
  renderPdf(
    records: FeedbackExportRecord[],
    generatedAt: Date,
  ): Promise<Uint8Array>;
}
