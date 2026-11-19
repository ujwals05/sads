import type { Request, Response } from "express";
import { HttpError } from "../../utils/httpError.js";
import { conversationService } from "./conversation.service.js";
import {
  conversationIdParamsSchema,
  createConversationSchema,
  listConversationsQuerySchema,
  updateConversationSchema,
  workspaceIdParamsSchema,
} from "./conversation.validation.js";

function requireUserId(req: Request): string {
  if (!req.authUser) {
    throw new HttpError(401, "UNAUTHENTICATED", "Authentication required.");
  }
  return req.authUser.id;
}

function parse<T>(
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } },
  value: unknown,
  message: string,
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpError(400, "VALIDATION_ERROR", message);
  }
  return result.data;
}

export const conversationController = {
  async list(req: Request, res: Response) {
    const userId = requireUserId(req);
    const { workspaceId } = parse(workspaceIdParamsSchema, req.params, "Invalid workspace ID.");
    const { limit } = parse(listConversationsQuerySchema, req.query, "Invalid query parameters.");

    const data = await conversationService.list(workspaceId, userId, limit);
    res.status(200).json({ data });
  },

  async create(req: Request, res: Response) {
    const userId = requireUserId(req);
    const { workspaceId } = parse(workspaceIdParamsSchema, req.params, "Invalid workspace ID.");
    const body = parse(createConversationSchema, req.body ?? {}, "Invalid conversation data.");

    const data = await conversationService.create(workspaceId, userId, body.title);
    res.status(201).json({ data });
  },

  async get(req: Request, res: Response) {
    const userId = requireUserId(req);
    const { conversationId } = parse(conversationIdParamsSchema, req.params, "Invalid conversation ID.");

    const data = await conversationService.get(conversationId, userId);
    res.status(200).json({ data });
  },

  async rename(req: Request, res: Response) {
    const userId = requireUserId(req);
    const { conversationId } = parse(conversationIdParamsSchema, req.params, "Invalid conversation ID.");
    const body = parse(updateConversationSchema, req.body, "Invalid conversation title.");

    const data = await conversationService.rename(conversationId, userId, body.title);
    res.status(200).json({ data });
  },

  async delete(req: Request, res: Response) {
    const userId = requireUserId(req);
    const { conversationId } = parse(conversationIdParamsSchema, req.params, "Invalid conversation ID.");

    await conversationService.delete(conversationId, userId);
    res.status(204).send();
  },
};
