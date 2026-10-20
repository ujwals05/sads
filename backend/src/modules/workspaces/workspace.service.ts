
import { workspaceRepository } from "./workspace.repository.js";
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
} from "./workspace.validation.js";

export class WorkspaceServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "WorkspaceServiceError";
  }
}

const requireWorkspaceRole = async (
  workspaceId: string,
  userId: string,
  allowedRoles: string[],
) => {
  const membership = await workspaceRepository.findMembership(
    workspaceId,
    userId,
  );

  if (!membership) {
    throw new WorkspaceServiceError(
      "WORKSPACE_NOT_FOUND",
      "Workspace not found.",
      404,
    );
  }

  if (!allowedRoles.includes(membership.role)) {
    throw new WorkspaceServiceError(
      "FORBIDDEN",
      "You do not have permission to perform this operation.",
      403,
    );
  }

  return membership;
};

export const workspaceService = {
  create(userId: string, input: CreateWorkspaceInput) {
    return workspaceRepository.create(userId, input);
  },

  list(userId: string) {
    return workspaceRepository.listForUser(userId);
  },

  async get(workspaceId: string, userId: string) {
    const workspace = await workspaceRepository.findForUser(
      workspaceId,
      userId,
    );

    if (!workspace) {
      throw new WorkspaceServiceError(
        "WORKSPACE_NOT_FOUND",
        "Workspace not found.",
        404,
      );
    }

    return workspace;
  },

  async update(
    workspaceId: string,
    userId: string,
    input: UpdateWorkspaceInput,
  ) {
    await requireWorkspaceRole(
      workspaceId,
      userId,
      ["OWNER", "ADMIN"],
    );

    return workspaceRepository.update(workspaceId, input);
  },

  async delete(workspaceId: string, userId: string) {
    await requireWorkspaceRole(
      workspaceId,
      userId,
      ["OWNER"],
    );

    return workspaceRepository.delete(workspaceId);
  },
};
