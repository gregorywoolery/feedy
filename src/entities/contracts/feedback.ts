export interface FeedbackPhotoRecord {
  id: string;
  originalFilename: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
  width: number | null;
  height: number | null;
  sortOrder: number;
  url: string;
}

export interface FeedbackListItem {
  id: string;
  projectId: string;
  projectName: string;
  projectVersion: string;
  description: string;
  photos: FeedbackPhotoRecord[];
  photoCount: number;
  createdAt: string;
  updatedAt: string;
}

export type FeedbackDetailRecord = FeedbackListItem;

export type FeedbackSort = "createdAt" | "updatedAt" | "project" | "version";
export type SortOrder = "asc" | "desc";
export type PhotoFilter = "all" | "yes" | "no";

export interface FeedbackQuery {
  q: string;
  project: string;
  version: string;
  hasPhotos: PhotoFilter;
  from: string;
  to: string;
  sort: FeedbackSort;
  order: SortOrder;
  page: number;
  pageSize: 10 | 25 | 50 | 100;
}

export interface FeedbackPage {
  items: FeedbackListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface FeedbackSummary {
  feedbackCount: number;
  projectCount: number;
  withPhotosCount: number;
}

export interface FeedbackExportRecord extends FeedbackDetailRecord {
  photoBytes: Array<FeedbackPhotoRecord & { bytes: Uint8Array }>;
}
