import { createProject } from "@/data-access/projects/project-repository";
import { createProjectSchema } from "@/lib/validation/projects";

export async function createProjectUseCase(input: unknown) {
  const values = createProjectSchema.parse(input);
  return createProject(values);
}
