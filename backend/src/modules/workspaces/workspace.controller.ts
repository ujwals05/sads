
import type { Request, Response } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  workspaceParamsSchema,
  addWorkspaceMemberSchema,
  workspaceMemberParamsSchema,
  updateWorkspaceMemberRoleSchema,
} from "./workspace.validation.js";
import {
  WorkspaceServiceError,
  workspaceService,
} from "./workspace.service.js";

const sendValidationError = (
  res: Response,
  message: string,
  details?: unknown,
) =>
  res.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message,
      ...(details ? { details } : {}),
    },
  });

const getUserId = (req: Request): string | null =>
  req.authUser?.id ?? null;

const handleError = (error: unknown, res: Response) => {
  if (error instanceof WorkspaceServiceError) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  ) {
    return res.status(409).json({
      error: {
        code: "RELATED_DATA_CONFLICT",
        message:
          "The workspace cannot be deleted while related records prevent deletion.",
      },
    });
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    return res.status(404).json({
      error: {
        code: "WORKSPACE_NOT_FOUND",
        message: "Workspace not found.",
      },
    });
  }

  return res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    },
  });
};

export const workspaceController = {
  async create(req: Request, res: Response) {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Authentication required." },
      });
    }

    const parsed = createWorkspaceSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendValidationError(
        res,
        "Invalid workspace data.",
        parsed.error.issues,
      );
    }

    try {
      const workspace = await workspaceService.create(userId, parsed.data);
      return res.status(201).json({ data: workspace });
    } catch (error) {
      return handleError(error, res);
    }
  },

  async list(req: Request, res: Response) {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Authentication required." },
      });
    }

    try {
      const workspaces = await workspaceService.list(userId);
      return res.status(200).json({ data: workspaces });
    } catch (error) {
      return handleError(error, res);
    }
  },

  async get(req: Request, res: Response) {
    const userId = getUserId(req);
    const params = workspaceParamsSchema.safeParse(req.params);

    if (!userId) {
      return res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Authentication required." },
      });
    }

    if (!params.success) {
      return sendValidationError(res, "Invalid workspace ID.");
    }

    try {
      const workspace = await workspaceService.get(
        params.data.workspaceId,
        userId,
      );
      return res.status(200).json({ data: workspace });
    } catch (error) {
      return handleError(error, res);
    }
  },

  async update(req: Request, res: Response) {
    const userId = getUserId(req);
    const params = workspaceParamsSchema.safeParse(req.params);
    const body = updateWorkspaceSchema.safeParse(req.body);

    if (!userId) {
      return res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Authentication required." },
      });
    }

    if (!params.success || !body.success) {
      return sendValidationError(res, "Invalid workspace update.");
    }

    try {
      const workspace = await workspaceService.update(
        params.data.workspaceId,
        userId,
        body.data,
      );
      return res.status(200).json({ data: workspace });
    } catch (error) {
      return handleError(error, res);
    }
  },

  async delete(req: Request, res: Response) {
    const userId = getUserId(req);
    const params = workspaceParamsSchema.safeParse(req.params);

    if (!userId) {
      return res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Authentication required." },
      });
    }

    if (!params.success) {
      return sendValidationError(res, "Invalid workspace ID.");
    }

    try {
      await workspaceService.delete(params.data.workspaceId, userId);
      return res.status(204).send();
    } catch (error) {
      return handleError(error, res);
    }
  },
  async addMember(req: Request, res: Response) {
  const userId = getUserId(req);
  const params = workspaceParamsSchema.safeParse(req.params);
  const body = addWorkspaceMemberSchema.safeParse(req.body);

  if (!userId) {
    return res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required.",
      },
    });
  }

  if (!params.success || !body.success) {
    return sendValidationError(res, "Invalid member data.");
  }

  try {
    const member = await workspaceService.addMember(
      params.data.workspaceId,
      userId,
      body.data,
    );

    return res.status(201).json({ data: member });
  } catch (error) {
    return handleError(error, res);
  }
},

async removeMember(req: Request, res: Response) {
  const userId = getUserId(req);
  const params = workspaceMemberParamsSchema.safeParse(req.params);

  if (!userId) {
    return res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required.",
      },
    });
  }

  if (!params.success) {
    return sendValidationError(res, "Invalid workspace or member ID.");
  }

  try {
    await workspaceService.removeMember(
      params.data.workspaceId,
      userId,
      params.data.userId,
    );

    return res.status(204).send();
  } catch (error) {
    return handleError(error, res);
  }
},

async updateMemberRole(req: Request, res: Response) {
  const userId = getUserId(req);
  const params = workspaceMemberParamsSchema.safeParse(req.params);
  const body = updateWorkspaceMemberRoleSchema.safeParse(req.body);

  if (!userId) {
    return res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required.",
      },
    });
  }

  if (!params.success || !body.success) {
    return sendValidationError(
      res,
      "Invalid workspace, member, or role data.",
    );
  }

  try {
    const updated = await workspaceService.updateMemberRole(
      params.data.workspaceId,
      userId,
      params.data.userId,
      body.data.role,
    );

    return res.status(200).json({ data: updated });
  } catch (error) {
    return handleError(error, res);
  }
},

};
