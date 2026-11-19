import { authedHandler as handler, parseOrThrow } from "../../utils/http.js";
import {
  addWorkspaceMemberSchema,
  createWorkspaceSchema,
  transferOwnershipSchema,
  updateWorkspaceMemberRoleSchema,
  updateWorkspaceSchema,
  workspaceMemberParamsSchema,
  workspaceParamsSchema,
} from "./workspace.validation.js";
import { workspaceService } from "./workspace.service.js";

export const workspaceController = {
  create: handler(async (req, res, userId) => {
    const body = parseOrThrow(createWorkspaceSchema, req.body, "Invalid workspace data.");
    const workspace = await workspaceService.create(userId, body);
    res.status(201).json({ data: workspace });
  }),

  list: handler(async (_req, res, userId) => {
    const workspaces = await workspaceService.list(userId);
    res.status(200).json({ data: workspaces });
  }),

  get: handler(async (req, res, userId) => {
    const { workspaceId } = parseOrThrow(workspaceParamsSchema, req.params, "Invalid workspace ID.");
    const workspace = await workspaceService.get(workspaceId, userId);
    res.status(200).json({ data: workspace });
  }),

  update: handler(async (req, res, userId) => {
    const { workspaceId } = parseOrThrow(workspaceParamsSchema, req.params, "Invalid workspace ID.");
    const body = parseOrThrow(updateWorkspaceSchema, req.body, "Invalid workspace update.");
    const workspace = await workspaceService.update(workspaceId, userId, body);
    res.status(200).json({ data: workspace });
  }),

  delete: handler(async (req, res, userId) => {
    const { workspaceId } = parseOrThrow(workspaceParamsSchema, req.params, "Invalid workspace ID.");
    await workspaceService.delete(workspaceId, userId);
    res.status(204).send();
  }),

  listMembers: handler(async (req, res, userId) => {
    const { workspaceId } = parseOrThrow(workspaceParamsSchema, req.params, "Invalid workspace ID.");
    const members = await workspaceService.listMembers(workspaceId, userId);
    res.status(200).json({ data: members });
  }),

  addMember: handler(async (req, res, userId) => {
    const { workspaceId } = parseOrThrow(workspaceParamsSchema, req.params, "Invalid workspace ID.");
    const body = parseOrThrow(addWorkspaceMemberSchema, req.body, "Invalid member data.");
    const member = await workspaceService.addMember(workspaceId, userId, body);
    res.status(201).json({ data: member });
  }),

  removeMember: handler(async (req, res, userId) => {
    const params = parseOrThrow(
      workspaceMemberParamsSchema,
      req.params,
      "Invalid workspace or member ID.",
    );
    await workspaceService.removeMember(params.workspaceId, userId, params.userId);
    res.status(204).send();
  }),

  updateMemberRole: handler(async (req, res, userId) => {
    const params = parseOrThrow(
      workspaceMemberParamsSchema,
      req.params,
      "Invalid workspace or member ID.",
    );
    const body = parseOrThrow(updateWorkspaceMemberRoleSchema, req.body, "Invalid role.");
    const member = await workspaceService.updateMemberRole(
      params.workspaceId,
      userId,
      params.userId,
      body.role,
    );
    res.status(200).json({ data: member });
  }),

  transferOwnership: handler(async (req, res, userId) => {
    const { workspaceId } = parseOrThrow(workspaceParamsSchema, req.params, "Invalid workspace ID.");
    const body = parseOrThrow(transferOwnershipSchema, req.body, "Invalid ownership transfer.");
    const members = await workspaceService.transferOwnership(workspaceId, userId, body.userId);
    res.status(200).json({ data: members });
  }),
};
