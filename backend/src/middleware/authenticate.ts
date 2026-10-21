
import type { NextFunction, Request, Response } from "express";

import { verifyAccessToken } from "../utils/jwt.js";
import { authRepository } from "../modules/auth/auth.repository.js";

export interface AuthenticatedUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "A valid bearer token is required.",
      },
    });
    return;
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "A valid bearer token is required.",
      },
    });
    return;
  }

  let payload;

  try {
    payload = verifyAccessToken(token);
  } catch {
    res.status(401).json({
      error: {
        code: "INVALID_TOKEN",
        message: "The access token is invalid or expired.",
      },
    });
    return;
  }

  try {
    // Load the current user from our own database.
    const user = await authRepository.findUserById(payload.id);

    if (!user) {
      res.status(401).json({
        error: {
          code: "INVALID_TOKEN",
          message: "The user associated with this token no longer exists.",
        },
      });
      return;
    }

    req.authUser = {
      id: user.id,
      email: user.email,
    };

    next();
  } catch (error: unknown) {
    next(error);
  }
}
  