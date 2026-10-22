
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { workspaceController } from "./workspace.controller.js";

export const workspaceRouter = Router();

workspaceRouter.use(authenticate);

workspaceRouter.post("/", workspaceController.create);
workspaceRouter.get("/", workspaceController.list);
workspaceRouter.get("/:workspaceId", workspaceController.get);
workspaceRouter.patch("/:workspaceId", workspaceController.update);
workspaceRouter.delete("/:workspaceId", workspaceController.delete);

workspaceRouter.post("/:workspaceId/members",workspaceController.addMember);