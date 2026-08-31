export interface ProjectRecord {
  id: string;
  name: string;
  description: string | null;
  feedbackCount: number;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectOption {
  id: string;
  name: string;
}
