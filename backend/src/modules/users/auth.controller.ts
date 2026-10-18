
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
          message: "Please provide a valid email and a password of at least 8 characters.",
        },
      });
      return;
    }

    try {
      const result = await authService.register(parsed.data);

      res.status(201).json({
        data: result,
      });
    } catch (error: unknown) {
      if (error instanceof AuthServiceError) {
        res.status(400).json({
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

      res.status(200).json({
        data: result,
      });
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
