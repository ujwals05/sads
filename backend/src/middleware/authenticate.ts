
import type { NextFunction, Request, Response } from "express";

import { supabase } from "../integrations/supabase/client.js";
import { userService } from "../modules/users/user.service.js";

export interface AuthenticatedUser {
  id: string;
  email: string | null;
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

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({
        error: {
          code: "INVALID_TOKEN",
          message: "The access token is invalid or expired.",
        },
      });
      return;
    }

    const user = await userService.provisionAuthenticatedUser(
      data.user.id,
    );

    req.authUser = {
      id: user.id,
      email: data.user.email ?? null,
    };

    next();
  } catch (error: unknown) {
    next(error);
  }
}
