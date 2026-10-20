
import { randomUUID, createHash } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";

import { authRepository } from "./auth.repository.js";
import type { LoginInput, RegisterInput } from "./auth.validation.js";

import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt.js";

import {
  hashedPassword,
  comparePassword,
} from "../../utils/hash.js";

const REFRESH_TOKEN_TTL_MS =
  30 * 24 * 60 * 60 * 1000; // 30 days

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
}

async function issueTokens(user: { id: string; email: string }) {
  const payload = {
    id: user.id,
    email: user.email,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  const refreshTokenExpiresAt = getRefreshTokenExpiry();

  await authRepository.saveRefreshToken(
    user.id,
    hashRefreshToken(refreshToken),
    refreshTokenExpiresAt,
  );

  return {
    accessToken,
    refreshToken,
    tokenType: "Bearer" as const,
    refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
  };
}

export const authService = {
  async register(input: RegisterInput) {
    const email = input.email.trim().toLowerCase();

    const existingUser = await authRepository.findUserByEmail(email);

    if (existingUser) {
      throw new AuthServiceError(
        "EMAIL_ALREADY_EXISTS",
        "An account with this email already exists.",
      );
    }

    const passwordHash = await hashedPassword(input.password);

    let user;

    try {
      user = await authRepository.createUser({
        id: randomUUID(),
        email,
        passwordHash,
      });
    } catch (error) {
      // Handle a concurrent registration for the same email.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AuthServiceError(
          "EMAIL_ALREADY_EXISTS",
          "An account with this email already exists.",
        );
      }

      throw error;
    }

    const tokens = await issueTokens(user);

    return {
      user,
      ...tokens,
    };
  },

  async login(input: LoginInput) {
    const email = input.email.trim().toLowerCase();

    const user = await authRepository.findUserByEmail(email);

    if (
      !user ||
      !(await comparePassword(input.password, user.passwordHash))
    ) {
      throw new AuthServiceError(
        "LOGIN_FAILED",
        "Invalid email or password.",
      );
    }

    const tokens = await issueTokens({
      id: user.id,
      email: user.email,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
      ...tokens,
    };
  },

  async refresh(rawRefreshToken: string) {
    if (!rawRefreshToken) {
      throw new AuthServiceError(
        "INVALID_REFRESH_TOKEN",
        "A refresh token is required.",
      );
    }

    let payload;

    try {
      payload = verifyRefreshToken(rawRefreshToken);
    } catch {
      throw new AuthServiceError(
        "INVALID_REFRESH_TOKEN",
        "The refresh token is invalid or expired. Please sign in again.",
      );
    }

    const currentHash = hashRefreshToken(rawRefreshToken);

    const user = await authRepository.findUserByRefreshTokenHash(
      currentHash,
    );

    if (
      !user ||
      user.id !== payload.id ||
      !user.refreshTokenExpiresAt ||
      user.refreshTokenExpiresAt <= new Date()
    ) {
      throw new AuthServiceError(
        "INVALID_REFRESH_TOKEN",
        "The refresh token is invalid or expired. Please sign in again.",
      );
    }

    const nextRefreshToken = signRefreshToken({
      id: user.id,
      email: user.email,
    });

    const nextExpiresAt = getRefreshTokenExpiry();

    const rotated = await authRepository.rotateRefreshToken({
      userId: user.id,
      currentHash,
      nextHash: hashRefreshToken(nextRefreshToken),
      nextExpiresAt,
    });

    if (!rotated) {
      throw new AuthServiceError(
        "REFRESH_REJECTED",
        "The refresh token has already been used or revoked. Please sign in again.",
      );
    }

    const accessToken = signAccessToken({
      id: user.id,
      email: user.email,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
      },
      accessToken,
      refreshToken: nextRefreshToken,
      tokenType: "Bearer" as const,
      refreshTokenExpiresAt: nextExpiresAt.toISOString(),
    };
  },

  async logout(userId: string) {
    await authRepository.revokeRefreshToken(userId);

    return { message: "Logged out successfully." };
  },
};

export class AuthServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}
