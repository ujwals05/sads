import type {
  ErrorRequestHandler,
} from "express";
import {Prisma} from "../generated/prisma/client.js";
import { HttpError } from "../utils/httpError.js";

export const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
  if (error instanceof HttpError) {
    if (res.headersSent) return;
    return res.status(error.statusCode).json({
      error: { code: error.code, message: error.message },
    });
  }

  // express.json() rejects malformed or oversized bodies with a status code.
  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    (error.type === "entity.parse.failed" ||
      error.type === "entity.too.large")
  ) {
    if (res.headersSent) return;
    const tooLarge = error.type === "entity.too.large";
    return res.status(tooLarge ? 413 : 400).json({
      error: {
        code: tooLarge ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON",
        message: tooLarge
          ? "The request body is too large."
          : "The request body is not valid JSON.",
      },
    });
  }

  console.error("Unhandled request error:", error);

  if (
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002"
) {
  return res.status(409).json({
    error: {
      code: "ALREADY_A_MEMBER",
      message: "This user is already a member of the workspace.",
    },
  });
}

  if (res.headersSent) {
    return;
  }

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected server error occurred.",
    },
  });
};
