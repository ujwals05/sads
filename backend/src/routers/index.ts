import { Router } from "express";
import { healthRouter } from "./health.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { workspaceRouter } from "../modules/workspaces/workspace.routes.js";
import { userRouter } from "../modules/users/user.routes.js";
import {
  conversationRouter,
  workspaceConversationRouter,
} from "../modules/conversations/conversation.routes.js";
import {
  conversationAgentRouter,
  taskRouter,
} from "../modules/agent/agent.routes.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/workspaces/:workspaceId/conversations", workspaceConversationRouter);
apiRouter.use("/workspaces", workspaceRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/conversations", conversationRouter);
apiRouter.use("/conversations", conversationAgentRouter);
apiRouter.use("/tasks", taskRouter);
