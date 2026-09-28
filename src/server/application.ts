import type { FeedbackQuery } from "@/entities/contracts/feedback";
import {
  getDashboardUseCase,
  getProjectsUseCase,
  getProjectDetailUseCase,
  getFeedbackDetailUseCase,
} from "@/use-cases/queries";
import "server-only";
import { withExportCapacity } from "./export-capacity";
import { exportFeedbackUseCase } from "@/use-cases/exports/export-feedback";
import { createFeedbackPdf } from "@/lib/export/pdf";

import * as feedback from "@/data-access/feedback/feedback-repository";
import * as projects from "@/data-access/projects/project-repository";
import { cleanupPhotos } from "@/lib/storage/cleanup";
import { getPhotoStorage } from "@/lib/storage";
import { validateAndNormalizePhotos } from "@/lib/validation/photos";
import type { ApplicationDependencies } from "@/use-cases/ports";
import { createFeedbackUseCase } from "@/use-cases/feedback/create-feedback";
import { updateFeedbackUseCase } from "@/use-cases/feedback/update-feedback";
import { deleteFeedbackUseCase } from "@/use-cases/feedback/delete-feedback";
import { getPhotoUseCase } from "@/use-cases/feedback/get-photo";
import { createProjectUseCase } from "@/use-cases/projects/create-project";
import { deleteProjectUseCase } from "@/use-cases/projects/delete-project";

export function getApplicationDependencies(): ApplicationDependencies {
  const storage = getPhotoStorage();
  return {
    feedback,
    projects,
    storage,
    normalizePhotos: validateAndNormalizePhotos,
    renderPdf: createFeedbackPdf,
    async cleanupPhotos(keys) {
      try {
        return await cleanupPhotos(storage, keys);
      } catch (error) {
        console.error("Photo cleanup remains pending.", error);
        return keys.length;
      }
    },
  };
}

export const createFeedback = (
  input: Parameters<typeof createFeedbackUseCase>[0],
) => createFeedbackUseCase(input, getApplicationDependencies());
export const updateFeedback = (
  input: Parameters<typeof updateFeedbackUseCase>[0],
) => updateFeedbackUseCase(input, getApplicationDependencies());
export const deleteFeedback = (input: unknown) =>
  deleteFeedbackUseCase(input, getApplicationDependencies());
export const getPhoto = (id: string) =>
  getPhotoUseCase(id, getApplicationDependencies());
export const createProject = (input: unknown) =>
  createProjectUseCase(input, getApplicationDependencies());
export const deleteProject = (id: string) =>
  deleteProjectUseCase(id, getApplicationDependencies());

export const exportFeedback = (input: unknown, single = false) =>
  withExportCapacity(() =>
    exportFeedbackUseCase(input, getApplicationDependencies(), single),
  );

export const getDashboard = (query: FeedbackQuery) =>
  getDashboardUseCase(query, getApplicationDependencies());
export const getProjects = () =>
  getProjectsUseCase(getApplicationDependencies());
export const getProjectDetail = (id: string, query: FeedbackQuery) =>
  getProjectDetailUseCase(id, query, getApplicationDependencies());
export const getFeedbackDetail = (id: string) =>
  getFeedbackDetailUseCase(id, getApplicationDependencies());
