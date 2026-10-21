import { Router } from "express";
import { healthRouter } from "./health.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { workspaceRouter } from "../modules/workspaces/workspace.routes.js";
import { userRouter } from "../modules/users/user.routes.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/workspaces", workspaceRouter);
apiRouter.use("/users", userRouter);