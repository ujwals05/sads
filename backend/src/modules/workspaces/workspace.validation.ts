import { z } from "zod";
import { ASSIGNABLE_ROLES } from "./workspace.permissions.js";

const uuidSchema = z.string().uuid();

const nameSchema = z
  .string()
  .trim()
  .min(1, "Workspace name is required.")
  .max(100, "Workspace name must not exceed 100 characters.");

const noNullByte = (value: string) => !value.includes("\0");

// Empty strings are normalised to null so a field can be cleared.
const descriptionSchema = z
  .string()
  .trim()
  .max(500, "Workspace description must not exceed 500 characters.")
  .refine(noNullByte, "Workspace description contains an invalid character.")
  .transform((value) => (value.length === 0 ? null : value))
  .nullable();

const rootPathSchema = z
  .string()
  .trim()
  .max(1024, "Workspace root path is too long.")
  .refine(noNullByte, "Workspace root path contains an invalid character.")
  .transform((value) => (value.length === 0 ? null : value))
  .nullable();

// `.strict()` rejects unknown keys so clients cannot smuggle in fields such
// as `createdById` or `role` that the server must control.
export const createWorkspaceSchema = z
  .object({
    name: nameSchema,
    description: descriptionSchema.optional(),
    rootPath: rootPathSchema.optional(),
  })
  .strict();

export const updateWorkspaceSchema = z
  .object({
    name: nameSchema.optional(),
    description: descriptionSchema.optional(),
    rootPath: rootPathSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.rootPath !== undefined,
    "At least one field must be provided.",
  );

export const workspaceParamsSchema = z.object({
  workspaceId: uuidSchema,
});

export const workspaceMemberParamsSchema = z.object({
  workspaceId: uuidSchema,
  userId: uuidSchema,
});

const assignableRoleSchema = z.enum(ASSIGNABLE_ROLES);

export const addWorkspaceMemberSchema = z
  .object({
    userId: uuidSchema,
    role: assignableRoleSchema.default("MEMBER"),
  })
  .strict();

export const updateWorkspaceMemberRoleSchema = z
  .object({
    role: assignableRoleSchema,
  })
  .strict();

export const transferOwnershipSchema = z
  .object({
    userId: uuidSchema,
  })
  .strict();

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type AddWorkspaceMemberInput = z.infer<typeof addWorkspaceMemberSchema>;
export type UpdateWorkspaceMemberRoleInput = z.infer<
  typeof updateWorkspaceMemberRoleSchema
>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
