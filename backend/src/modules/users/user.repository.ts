import { prisma } from "../../db/prisma.js";

export const userRepository = {
  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  },
  async searchUsers(input: {
    q: string;
    page: number;
    limit: number;
    workspaceId?: string;
  }) {
    const where = {
      email: {
        contains: input.q,
        mode: "insensitive" as const,
      },
      ...(input.workspaceId
        ? {
            memberships: {
              none: {
                workspaceId: input.workspaceId,
              },
            },
          }
        : {}),
    };

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
        },
        orderBy: { email: "asc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  },
};