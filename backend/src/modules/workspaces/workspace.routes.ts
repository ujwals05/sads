import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { workspaceController } from "./workspace.controller.js";

export const workspaceRouter = Router();

// Every workspace route requires a valid access token. Membership and role
// checks are enforced per-operation in workspace.service.
workspaceRouter.use(authenticate);

workspaceRouter.post("/", workspaceController.create);
workspaceRouter.get("/", workspaceController.list);
workspaceRouter.get("/:workspaceId", workspaceController.get);
workspaceRouter.patch("/:workspaceId", workspaceController.update);
workspaceRouter.delete("/:workspaceId", workspaceController.delete);

workspaceRouter.get("/:workspaceId/members", workspaceController.listMembers);
workspaceRouter.post("/:workspaceId/members", workspaceController.addMember);
workspaceRouter.patch("/:workspaceId/members/:userId", workspaceController.updateMemberRole);
workspaceRouter.delete("/:workspaceId/members/:userId", workspaceController.removeMember);

workspaceRouter.post("/:workspaceId/transfer-ownership", workspaceController.transferOwnership);
