
import { prisma } from "../../db/prisma.js";

export const workspaceRepository = {
  create(
    userId: string,
    input: { name: string; rootPath: string },
  ) {
    return prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: input.name,
          rootPath: input.rootPath,
          createdById: userId,
        },
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

  listForUser(userId: string) {
    return prisma.workspace.findMany({
      where: {
        members: { some: { userId } },
      },
      orderBy: { updatedAt: "desc" },
    });
  },

  findForUser(workspaceId: string, userId: string) {
    return prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        members: { some: { userId } },
      },
      include: {
        members: {
          select: {
            userId: true,
            role: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
      },
    });
  },

  findMembership(workspaceId: string, userId: string) {
    return prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
    });
  },

  update(
    workspaceId: string,
    input: { name?: string; rootPath?: string },
  ) {
    return prisma.workspace.update({
      where: { id: workspaceId },
      data: input,
    });
  },

  delete(workspaceId: string) {
    return prisma.workspace.delete({
      where: { id: workspaceId },
    });
  },
  
  addMember(
    workspaceId: string,
    userId: string,
    role: "ADMIN" | "DEVELOPER" | "VIEWER",
  ) {
    return prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId,
        role,
      },
      select: {
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
      },
    });
  },

  removeMember(workspaceId: string, userId: string) {
    return prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
    });
  },

  updateMemberRole(
    workspaceId: string,
    userId: string,
    role: "ADMIN" | "DEVELOPER" | "VIEWER",
  ) {
    return prisma.workspaceMember.update({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
      data: { role },
      select: {
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
      },
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
