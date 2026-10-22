import type {
  ErrorRequestHandler,
} from "express";
import {Prisma} from "../generated/prisma/client.js";

export const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
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
