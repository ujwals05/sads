import type { Request, Response } from "express";
import { HttpError } from "../../utils/httpError.js";
import { conversationIdParamsSchema } from "../conversations/conversation.validation.js";
import { agentService } from "./agent.service.js";
import {
  startTurnSchema,
  taskIdParamsSchema,
  toolResultsSchema,
} from "./agent.validation.js";

function requireUserId(req: Request): string {
  if (!req.authUser) {
    throw new HttpError(401, "UNAUTHENTICATED", "Authentication required.");
  }
  return req.authUser.id;
}

export const agentController = {
  /** POST /conversations/:conversationId/turns */
  async startTurn(req: Request, res: Response) {
    const userId = requireUserId(req);
    const params = conversationIdParamsSchema.safeParse(req.params);
    const body = startTurnSchema.safeParse(req.body);

    if (!params.success || !body.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid agent request.");
    }

    const data = await agentService.startTurn(
      params.data.conversationId,
      userId,
      body.data,
    );
    res.status(200).json({ data });
  },

  /** POST /tasks/:taskId/tool-results */
  async submitToolResults(req: Request, res: Response) {
    const userId = requireUserId(req);
    const params = taskIdParamsSchema.safeParse(req.params);
    const body = toolResultsSchema.safeParse(req.body);

    if (!params.success || !body.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid tool results.");
    }

    const data = await agentService.submitToolResults(
      params.data.taskId,
      userId,
      body.data.results,
    );
    res.status(200).json({ data });
  },

  /** POST /tasks/:taskId/cancel */
  async cancel(req: Request, res: Response) {
    const userId = requireUserId(req);
    const params = taskIdParamsSchema.safeParse(req.params);

    if (!params.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid task ID.");
    }

    const data = await agentService.cancel(params.data.taskId, userId);
    res.status(200).json({ data });
  },
};
