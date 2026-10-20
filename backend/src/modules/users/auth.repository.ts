
import { prisma } from "../../db/prisma.js";

export const authRepository = {
  findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  },

  findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });
  },

  createUser(input: {
    id: string;
    email: string;
    passwordHash: string;
  }) {
    return prisma.user.create({
      data: input,
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });
  },

  saveRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokenHash: tokenHash,
        refreshTokenExpiresAt: expiresAt,
      },
    });
  },

  findUserByRefreshTokenHash(tokenHash: string) {
    return prisma.user.findFirst({
      where: {
        refreshTokenHash: tokenHash,
      },
      select: {
        id: true,
        email: true,
        refreshTokenExpiresAt: true,
      },
    });
  },

  async rotateRefreshToken(input: {
    userId: string;
    currentHash: string;
    nextHash: string;
    nextExpiresAt: Date;
  }): Promise<boolean> {
    const result = await prisma.user.updateMany({
      where: {
        id: input.userId,
        refreshTokenHash: input.currentHash,
        refreshTokenExpiresAt: {
          gt: new Date(),
        },
      },
      data: {
        refreshTokenHash: input.nextHash,
        refreshTokenExpiresAt: input.nextExpiresAt,
      },
    });

    // Only one concurrent request can rotate the same token.
    return result.count === 1;
  },

  async revokeRefreshToken(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });
  },
};
