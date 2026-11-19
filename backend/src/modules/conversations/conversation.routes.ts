import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { conversationController } from "./conversation.controller.js";

/** Mounted at /workspaces/:workspaceId/conversations */
export const workspaceConversationRouter = Router({ mergeParams: true });
workspaceConversationRouter.use(authenticate);
workspaceConversationRouter.get("/", conversationController.list);
workspaceConversationRouter.post("/", conversationController.create);

/** Mounted at /conversations */
export const conversationRouter = Router();
conversationRouter.use(authenticate);
conversationRouter.get("/:conversationId", conversationController.get);
conversationRouter.patch("/:conversationId", conversationController.rename);
conversationRouter.delete("/:conversationId", conversationController.delete);
