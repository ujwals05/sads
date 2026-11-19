import { Prisma } from "../../generated/prisma/client.js";
import { ServiceError } from "../../utils/http.js";
import { workspaceRepository } from "./workspace.repository.js";
import {
  assignableRolesFor,
  canDeleteWorkspace,
  canUpdateWorkspace,
  checkAddMember,
  checkChangeRole,
  checkRemoveMember,
  checkTransferOwnership,
  type AssignableRole,
  type PermissionDecision,
  type WorkspaceRoleName,
} from "./workspace.permissions.js";
import type {
  AddWorkspaceMemberInput,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
} from "./workspace.validation.js";

export class WorkspaceServiceError extends ServiceError {
  constructor(code: string, message: string, statusCode: number) {
    super(code, message, statusCode);
    this.name = "WorkspaceServiceError";
  }
}

// Non-members always get 404 (never 403) so workspace IDs cannot be probed.
const workspaceNotFound = () =>
  new WorkspaceServiceError("WORKSPACE_NOT_FOUND", "Workspace not found.", 404);

const memberNotFound = () =>
  new WorkspaceServiceError(
    "MEMBER_NOT_FOUND",
    "The specified user is not a member of this workspace.",
    404,
  );

const forbidden = (message: string) =>
  new WorkspaceServiceError("FORBIDDEN", message, 403);

function enforce(decision: PermissionDecision): void {
  if (!decision.allowed) throw forbidden(decision.reason);
}

function isPrismaError(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

/**
 * Verify that `userId` is a member of `workspaceId` and return the
 * membership. This is the gate every workspace-scoped operation (including
 * conversations) goes through; the workspace ID from the client is never
 * trusted on its own.
 */
export async function requireMembership(workspaceId: string, userId: string) {
  const membership = await workspaceRepository.findMembership(
    workspaceId,
    userId,
  );
  if (!membership) throw workspaceNotFound();
  return membership as typeof membership & { role: WorkspaceRoleName };
}

export const workspaceService = {
  create(userId: string, input: CreateWorkspaceInput) {
    return workspaceRepository
      .create(userId, input)
      .then((workspace) => ({
        ...workspace,
        role: "OWNER" as const,
        memberCount: 1,
        conversationCount: 0,
      }));
  },

  list(userId: string) {
    return workspaceRepository.listForUser(userId);
  },

  async get(workspaceId: string, userId: string) {
    const membership = await requireMembership(workspaceId, userId);
    const workspace = await workspaceRepository.findById(workspaceId);
    if (!workspace) throw workspaceNotFound();

    return {
      ...workspace,
      role: membership.role,
      permissions: {
        canUpdate: canUpdateWorkspace(membership.role),
        canDelete: canDeleteWorkspace(membership.role),
        assignableRoles: assignableRolesFor(membership.role),
      },
    };
  },

  async update(
    workspaceId: string,
    userId: string,
    input: UpdateWorkspaceInput,
  ) {
    const membership = await requireMembership(workspaceId, userId);
    if (!canUpdateWorkspace(membership.role)) {
      throw forbidden("Only the workspace owner or an admin can update workspace settings.");
    }
    return workspaceRepository.update(workspaceId, input);
  },

  async delete(workspaceId: string, userId: string) {
    const membership = await requireMembership(workspaceId, userId);
    if (!canDeleteWorkspace(membership.role)) {
      throw forbidden("Only the workspace owner can delete the workspace.");
    }
    try {
      await workspaceRepository.delete(workspaceId);
    } catch (error) {
      if (isPrismaError(error, "P2025")) throw workspaceNotFound();
      throw error;
    }
  },

  async listMembers(workspaceId: string, userId: string) {
    await requireMembership(workspaceId, userId);
    return workspaceRepository.listMembers(workspaceId);
  },

  async addMember(
    workspaceId: string,
    requesterId: string,
    input: AddWorkspaceMemberInput,
  ) {
    const requester = await requireMembership(workspaceId, requesterId);
    enforce(checkAddMember(requester.role, input.role));

    const targetUser = await workspaceRepository.findUserById(input.userId);
    if (!targetUser) {
      throw new WorkspaceServiceError(
        "USER_NOT_FOUND",
        "The specified user does not exist.",
        404,
      );
    }

    const alreadyMember = () =>
      new WorkspaceServiceError(
        "ALREADY_A_MEMBER",
        `${targetUser.email} is already a member of this workspace.`,
        409,
      );

    const existing = await workspaceRepository.findMembership(
      workspaceId,
      input.userId,
    );
    if (existing) throw alreadyMember();

    try {
      return await workspaceRepository.addMember(
        workspaceId,
        input.userId,
        input.role,
      );
    } catch (error) {
      // Concurrent add of the same user: the composite primary key wins.
      if (isPrismaError(error, "P2002")) throw alreadyMember();
      throw error;
    }
  },

  async removeMember(
    workspaceId: string,
    requesterId: string,
    targetUserId: string,
  ) {
    const requester = await requireMembership(workspaceId, requesterId);
    const target = await workspaceRepository.findMembership(
      workspaceId,
      targetUserId,
    );
    if (!target) throw memberNotFound();

    enforce(
      checkRemoveMember({
        actorId: requesterId,
        actorRole: requester.role,
        targetId: targetUserId,
        targetRole: target.role as WorkspaceRoleName,
      }),
    );

    try {
      await workspaceRepository.removeMember(workspaceId, targetUserId);
    } catch (error) {
      if (isPrismaError(error, "P2025")) throw memberNotFound();
      throw error;
    }
  },

  async updateMemberRole(
    workspaceId: string,
    requesterId: string,
    targetUserId: string,
    newRole: AssignableRole,
  ) {
    const requester = await requireMembership(workspaceId, requesterId);
    const target = await workspaceRepository.findMembership(
      workspaceId,
      targetUserId,
    );
    if (!target) throw memberNotFound();

    const targetRole = target.role as WorkspaceRoleName;

    enforce(
      checkChangeRole({
        actorId: requesterId,
        actorRole: requester.role,
        targetId: targetUserId,
        targetRole,
        newRole,
      }),
    );

    const updated = await workspaceRepository.updateMemberRole(
      workspaceId,
      targetUserId,
      targetRole,
      newRole,
    );

    if (!updated) {
      throw new WorkspaceServiceError(
        "MEMBERSHIP_CHANGED",
        "This member was changed by someone else. Refresh and try again.",
        409,
      );
    }

    return updated;
  },

  async transferOwnership(
    workspaceId: string,
    requesterId: string,
    newOwnerId: string,
  ) {
    const requester = await requireMembership(workspaceId, requesterId);
    enforce(
      checkTransferOwnership({
        actorId: requesterId,
        actorRole: requester.role,
        targetId: newOwnerId,
      }),
    );

    const target = await workspaceRepository.findMembership(
      workspaceId,
      newOwnerId,
    );
    if (!target) throw memberNotFound();

    const transferred = await workspaceRepository.transferOwnership(
      workspaceId,
      requesterId,
      newOwnerId,
    );

    if (!transferred) {
      throw new WorkspaceServiceError(
        "MEMBERSHIP_CHANGED",
        "Ownership could not be transferred because the membership changed. Refresh and try again.",
        409,
      );
    }

    return workspaceRepository.listMembers(workspaceId);
  },
};
