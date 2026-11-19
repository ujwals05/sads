import type { ErrorRequestHandler } from "express";
import { Prisma } from "../generated/prisma/client.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (res.headersSent) {
    return;
  }

  // Malformed JSON body from express.json().
  if (
    error instanceof SyntaxError &&
    (error as SyntaxError & { status?: number }).status === 400
  ) {
    res.status(400).json({
      error: { code: "INVALID_JSON", message: "Request body is not valid JSON." },
    });
    return;
  }

  // Unique-constraint violations that a service did not translate itself.
  // Modules map their own P2002 cases (e.g. ALREADY_A_MEMBER) explicitly.
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    res.status(409).json({
      error: {
        code: "CONFLICT",
        message: "The resource already exists.",
      },
    });
    return;
  }

  console.error("Unhandled request error:", error);

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected server error occurred.",
    },
  });
};
