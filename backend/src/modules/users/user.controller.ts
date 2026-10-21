
import type { Request, Response, NextFunction } from "express";
import { searchUsersSchema } from "./user.validation.js";
import { userService } from "./user.service.js";

export const userController = {
  async search(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const parsed = searchUsersSchema.safeParse(req.query);

      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid search parameters.",
            issues: parsed.error.issues,
          },
        });
        return;
      }

      const result = await userService.search(parsed.data);
      res.status(200).json(result);
    } catch (error: unknown) {
      next(error);
    }
  },
};
