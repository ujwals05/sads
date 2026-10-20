import { z } from "zod";

const workspaceIdSchema = z.string().uuid();

const nameSchema = z
  .string()
  .trim()
  .min(1, "Workspace name is required.")
  .max(100, "Workspace name must not exceed 100 characters.");

const rootPathSchema = z
  .string()
  .trim()
  .min(1, "Workspace root path is required.")
  .max(1024, "Workspace root path is too long.")
  .refine(
    (value) => !value.includes("\0"),
    "Workspace root path contains an invalid character.",
  );

export const createWorkspaceSchema = z.object({
  name: nameSchema,
  rootPath: rootPathSchema,
});

export const updateWorkspaceSchema = z
  .object({
    name: nameSchema.optional(),
    rootPath: rootPathSchema.optional(),
  })
  .refine(
    (value) => value.name !== undefined || value.rootPath !== undefined,
    "At least one field must be provided.",
  );

export const workspaceParamsSchema = z.object({
  workspaceId: workspaceIdSchema,
});

export type CreateWorkspaceInput = z.infer<
  typeof createWorkspaceSchema
>;

export type UpdateWorkspaceInput = z.infer<
  typeof updateWorkspaceSchema
>;
