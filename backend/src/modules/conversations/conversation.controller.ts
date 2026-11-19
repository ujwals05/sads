import { authedHandler, parseOrThrow } from "../../utils/http.js";
import {
  conversationParamsSchema,
  createConversationSchema,
  listConversationsQuerySchema,
  sendMessageSchema,
  updateConversationSchema,
} from "./conversation.validation.js";
import { conversationService } from "./conversation.service.js";

export const conversationController = {
  list: authedHandler(async (req, res, userId) => {
    const query = parseOrThrow(
      listConversationsQuerySchema,
      req.query,
      "Invalid conversation filter.",
    );
    const conversations = await conversationService.list(userId, query.workspaceId);
    res.status(200).json({ data: conversations });
  }),

  create: authedHandler(async (req, res, userId) => {
    const body = parseOrThrow(
      createConversationSchema,
      req.body ?? {},
      "Invalid conversation data.",
    );
    const conversation = await conversationService.create(userId, body);
    res.status(201).json({ data: conversation });
  }),

  get: authedHandler(async (req, res, userId) => {
    const { conversationId } = parseOrThrow(
      conversationParamsSchema,
      req.params,
      "Invalid conversation ID.",
    );
    const conversation = await conversationService.get(conversationId, userId);
    res.status(200).json({ data: conversation });
  }),

  rename: authedHandler(async (req, res, userId) => {
    const { conversationId } = parseOrThrow(
      conversationParamsSchema,
      req.params,
      "Invalid conversation ID.",
    );
    const body = parseOrThrow(updateConversationSchema, req.body, "Invalid title.");
    const conversation = await conversationService.rename(
      conversationId,
      userId,
      body.title,
    );
    res.status(200).json({ data: conversation });
  }),

  delete: authedHandler(async (req, res, userId) => {
    const { conversationId } = parseOrThrow(
      conversationParamsSchema,
      req.params,
      "Invalid conversation ID.",
    );
    await conversationService.delete(conversationId, userId);
    res.status(204).send();
  }),

  sendMessage: authedHandler(async (req, res, userId) => {
    const { conversationId } = parseOrThrow(
      conversationParamsSchema,
      req.params,
      "Invalid conversation ID.",
    );
    const body = parseOrThrow(sendMessageSchema, req.body, "Invalid message.");
    const result = await conversationService.sendMessage(conversationId, userId, body);
    res.status(201).json({ data: result });
  }),
};
