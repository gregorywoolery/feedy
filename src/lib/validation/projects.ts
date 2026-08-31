import { z } from "zod";

export const projectIdSchema = z.string().uuid();

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a project name.")
    .max(160, "Project names must be 160 characters or fewer."),
  description: z
    .string()
    .trim()
    .max(4000, "Project descriptions must be 4,000 characters or fewer.")
    .optional()
    .transform((value) => value || null)
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
