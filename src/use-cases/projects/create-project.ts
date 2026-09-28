import type { ApplicationDependencies } from "@/use-cases/ports";
import { createProjectSchema } from "@/lib/validation/projects";

export async function createProjectUseCase(
  input: unknown,
  dependencies: ApplicationDependencies,
) {
  const values = createProjectSchema.parse(input);
  return dependencies.projects.createProject(values);
}
