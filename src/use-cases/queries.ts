import type { FeedbackQuery } from "@/entities/contracts/feedback";
import type { ApplicationDependencies } from "./ports";
import { presentFeedback, presentFeedbackPage } from "./present-feedback";

export async function getDashboardUseCase(
  query: FeedbackQuery,
  dependencies: ApplicationDependencies,
) {
  const [page, summary, projects, versions] = await Promise.all([
    dependencies.feedback.listFeedback(query),
    dependencies.feedback.getFeedbackSummary(),
    dependencies.projects.listProjectOptions(),
    dependencies.feedback.listFeedbackVersions(query.project || undefined),
  ]);
  return { page: presentFeedbackPage(page), summary, projects, versions };
}

export async function getProjectsUseCase(
  dependencies: ApplicationDependencies,
) {
  const [projects, options] = await Promise.all([
    dependencies.projects.listProjects(),
    dependencies.projects.listProjectOptions(),
  ]);
  return { projects, options };
}

export async function getProjectDetailUseCase(
  id: string,
  query: FeedbackQuery,
  dependencies: ApplicationDependencies,
) {
  const scopedQuery = { ...query, project: id };
  const [project, page, projectOptions, versions] = await Promise.all([
    dependencies.projects.getProjectById(id),
    dependencies.feedback.listFeedback(scopedQuery),
    dependencies.projects.listProjectOptions(),
    dependencies.feedback.listFeedbackVersions(id),
  ]);
  return {
    project,
    feedbackPage: presentFeedbackPage(page),
    projectOptions,
    versions,
  };
}

export async function getFeedbackDetailUseCase(
  id: string,
  dependencies: ApplicationDependencies,
) {
  const feedback = await dependencies.feedback.getFeedbackById(id);
  return feedback ? presentFeedback(feedback) : null;
}
