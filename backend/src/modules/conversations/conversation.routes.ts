import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { conversationController } from "./conversation.controller.js";

export const conversationRouter = Router();

// Access is checked per conversation in conversation.service: workspace
// conversations require current membership, personal ones require ownership.
conversationRouter.use(authenticate);

conversationRouter.get("/", conversationController.list);
conversationRouter.post("/", conversationController.create);
conversationRouter.get("/:conversationId", conversationController.get);
conversationRouter.patch("/:conversationId", conversationController.rename);
conversationRouter.delete("/:conversationId", conversationController.delete);
conversationRouter.post("/:conversationId/messages", conversationController.sendMessage);
