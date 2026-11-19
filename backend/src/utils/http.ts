import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

/** Domain error carrying an HTTP status and a stable machine-readable code. */
export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export class ValidationFailure extends Error {
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ValidationFailure";
  }
}

export function parseOrThrow<T>(
  schema: ZodType<T>,
  value: unknown,
  message: string,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationFailure(
      message,
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  return parsed.data;
}

type AuthedHandler = (
  req: Request,
  res: Response,
  userId: string,
) => Promise<void>;

/**
 * Wraps an authenticated route handler: enforces that `authenticate` ran,
 * maps validation and service errors to the standard error envelope, and
 * forwards anything unexpected to the global error handler.
 */
export function authedHandler(fn: AuthedHandler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Authentication required." },
      });
      return;
    }

    try {
      await fn(req, res, userId);
    } catch (error) {
      if (error instanceof ValidationFailure) {
        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: error.message,
            ...(error.details ? { details: error.details } : {}),
          },
        });
        return;
      }
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json({
          error: { code: error.code, message: error.message },
        });
        return;
      }
      next(error);
    }
  };
}
