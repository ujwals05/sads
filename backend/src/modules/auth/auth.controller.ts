
import type { Request, Response } from "express";

import { authService, AuthServiceError } from "./auth.service.js";
import { loginSchema, registerSchema } from "./auth.validation.js";

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Please provide a valid email and a password of at least 8 characters.",
        },
      });
      return;
    }

    try {
      const result = await authService.register(parsed.data);

      res.status(201).json({ data: result });
    } catch (error: unknown) {
      if (error instanceof AuthServiceError) {
        const status = error.code === "EMAIL_ALREADY_EXISTS" ? 409 : 400;

        res.status(status).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      throw error;
    }
  },

  async login(req: Request, res: Response): Promise<void> {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Please provide a valid email and password.",
        },
      });
      return;
    }

    try {
      const result = await authService.login(parsed.data);

      res.status(200).json({ data: result });
    } catch (error: unknown) {
      if (error instanceof AuthServiceError) {
        res.status(401).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      throw error;
    }
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const refreshToken: unknown = req.body?.refreshToken;

    if (
      typeof refreshToken !== "string" ||
      refreshToken.trim().length === 0
    ) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "A refresh token is required.",
        },
      });
      return;
    }

    try {
      const result = await authService.refresh(refreshToken);

      res.status(200).json({ data: result });
    } catch (error: unknown) {
      if (error instanceof AuthServiceError) {
        res.status(401).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      throw error;
    }
  },

  async logout(req: Request, res: Response): Promise<void> {
    if (!req.authUser) {
      res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication is required.",
        },
      });
      return;
    }

    try {
      const result = await authService.logout(req.authUser.id);

      res.status(200).json({ data: result });
    } catch (error: unknown) {
      throw error;
    }
  },

  me(req: Request, res: Response): void {
    if (!req.authUser) {
      res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication is required.",
        },
      });
      return;
    }

    res.status(200).json({
      data: {
        user: req.authUser,
      },
    });
  },
};
