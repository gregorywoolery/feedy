import type { ApplicationDependencies } from "@/use-cases/ports";
import type { CreateProjectInput } from "@/lib/validation/projects";

export async function createProjectUseCase(
  input: CreateProjectInput,
  dependencies: ApplicationDependencies,
) {
  return dependencies.projects.createProject(input);
}
