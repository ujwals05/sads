
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
};
