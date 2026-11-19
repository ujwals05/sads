
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

import {apiRouter} from "./routers/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  // Larger bodies are allowed only on the agent tool-results route.
  app.use((req, res, next) => {
    if (/^\/api\/v1\/tasks\/[^/]+\/tool-results$/.test(req.path)) {
      next();
      return;
    }
    express.json({ limit: "1mb" })(req, res, next);
  });

  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 100,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use("/api/v1", apiRouter);

  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
      },
    });
  });

  app.use(errorHandler);

  return app;
}
