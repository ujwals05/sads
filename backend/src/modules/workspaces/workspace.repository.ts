import { prisma } from "../../db/prisma.js";
import type {
  AssignableRole,
  WorkspaceRoleName,
} from "./workspace.permissions.js";

const memberSelect = {
  workspaceId: true,
  userId: true,
  role: true,
  joinedAt: true,
  user: {
    select: {
      id: true,
      email: true,
    },
  },
} as const;

const workspaceSelect = {
  id: true,
  name: true,
  description: true,
  rootPath: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const workspaceRepository = {
  create(
    userId: string,
    input: {
      name: string;
      description?: string | null;
      rootPath?: string | null;
    },
  ) {
    // Workspace and OWNER membership are created atomically so a workspace
    // can never exist without an owner.
    return prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          rootPath: input.rootPath ?? null,
          createdById: userId,
        },
        select: workspaceSelect,
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: "OWNER",
        },
      });

      return workspace;
    });
  },

  async listForUser(userId: string) {
    const workspaces = await prisma.workspace.findMany({
      where: {
        members: { some: { userId } },
      },
      select: {
        ...workspaceSelect,
        members: {
          where: { userId },
          select: { role: true },
        },
        _count: {
          select: { members: true, conversations: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return workspaces.map(({ members, _count, ...workspace }) => ({
      ...workspace,
      role: members[0]?.role ?? null,
      memberCount: _count.members,
      conversationCount: _count.conversations,
    }));
  },

  findById(workspaceId: string) {
    return prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        ...workspaceSelect,
        members: {
          select: memberSelect,
          orderBy: { joinedAt: "asc" },
        },
      },
    });
  },

  findMembership(workspaceId: string, userId: string) {
    return prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
      select: {
        workspaceId: true,
        userId: true,
        role: true,
        joinedAt: true,
      },
    });
  },

  listMembers(workspaceId: string) {
    return prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: memberSelect,
      orderBy: { joinedAt: "asc" },
    });
  },

  update(
    workspaceId: string,
    input: {
      name?: string;
      description?: string | null;
      rootPath?: string | null;
    },
  ) {
    return prisma.workspace.update({
      where: { id: workspaceId },
      data: input,
      select: workspaceSelect,
    });
  },

  delete(workspaceId: string) {
    return prisma.workspace.delete({
      where: { id: workspaceId },
      select: { id: true },
    });
  },

  addMember(workspaceId: string, userId: string, role: AssignableRole) {
    return prisma.workspaceMember.create({
      data: { workspaceId, userId, role },
      select: memberSelect,
    });
  },

  removeMember(workspaceId: string, userId: string) {
    return prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
      select: { workspaceId: true, userId: true },
    });
  },

  async updateMemberRole(
    workspaceId: string,
    userId: string,
    expectedCurrentRole: WorkspaceRoleName,
    role: AssignableRole,
  ) {
    // Conditional update: only applies if the target still has the role the
    // permission check was made against (guards against concurrent changes).
    const result = await prisma.workspaceMember.updateMany({
      where: {
        workspaceId,
        userId,
        role: expectedCurrentRole,
      },
      data: { role },
    });

    if (result.count !== 1) return null;

    return prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: memberSelect,
    });
  },

  /**
   * Atomically demote the current owner to ADMIN and promote the target to
   * OWNER. Returns false if either precondition no longer holds.
   */
  transferOwnership(
    workspaceId: string,
    currentOwnerId: string,
    newOwnerId: string,
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const demoted = await tx.workspaceMember.updateMany({
        where: { workspaceId, userId: currentOwnerId, role: "OWNER" },
        data: { role: "ADMIN" },
      });

      if (demoted.count !== 1) {
        throw new TransferAbortedError();
      }

      const promoted = await tx.workspaceMember.updateMany({
        where: {
          workspaceId,
          userId: newOwnerId,
          role: { in: ["ADMIN", "MEMBER"] },
        },
        data: { role: "OWNER" },
      });

      if (promoted.count !== 1) {
        // Throwing rolls the whole transaction back.
        throw new TransferAbortedError();
      }

      return true;
    }).catch((error: unknown) => {
      if (error instanceof TransferAbortedError) return false;
      throw error;
    });
  },

  findUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
      },
    });
  },
};

class TransferAbortedError extends Error {}
