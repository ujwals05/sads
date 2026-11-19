import express, { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { agentController } from "./agent.controller.js";

/** Mounted at /conversations (alongside the conversation routes). */
export const conversationAgentRouter = Router();
conversationAgentRouter.use(authenticate);
conversationAgentRouter.post("/:conversationId/turns", agentController.startTurn);

/** Mounted at /tasks */
export const taskRouter = Router();
taskRouter.use(authenticate);
// Tool results can carry file contents and command output.
taskRouter.post(
  "/:taskId/tool-results",
  express.json({ limit: "8mb" }),
  agentController.submitToolResults,
);
taskRouter.post("/:taskId/cancel", agentController.cancel);
