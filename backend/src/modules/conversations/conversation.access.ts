import { prisma } from "../../db/prisma.js";
import type { WorkspaceRole } from "../../generated/prisma/client.js";
import { HttpError } from "../../utils/httpError.js";

/** Roles allowed to run the coding agent (VIEWERs can only read chats). */
export const AGENT_ROLES: WorkspaceRole[] = ["OWNER", "ADMIN", "DEVELOPER"];

/**
 * Ensures the user is a member of the workspace (optionally with one of the
 * given roles). Non-members get a 404 so workspace IDs are not disclosed.
 */
export async function requireWorkspaceMember(
  workspaceId: string,
  userId: string,
  allowedRoles?: WorkspaceRole[],
) {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (!membership) {
    throw new HttpError(404, "WORKSPACE_NOT_FOUND", "Workspace not found.");
  }

  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    throw new HttpError(
      403,
      "FORBIDDEN",
      "Your workspace role does not allow this operation.",
    );
  }

  return membership;
}

/** Loads a conversation and checks the user can access its workspace. */
export async function requireConversationAccess(
  conversationId: string,
  userId: string,
  allowedRoles?: WorkspaceRole[],
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { workspace: { select: { id: true, name: true, rootPath: true } } },
  });

  if (!conversation) {
    throw new HttpError(
      404,
      "CONVERSATION_NOT_FOUND",
      "Conversation not found.",
    );
  }

  try {
    const membership = await requireWorkspaceMember(
      conversation.workspaceId,
      userId,
      allowedRoles,
    );
    return { conversation, membership };
  } catch (error) {
    // Do not reveal that the conversation exists to non-members.
    if (error instanceof HttpError && error.statusCode === 404) {
      throw new HttpError(
        404,
        "CONVERSATION_NOT_FOUND",
        "Conversation not found.",
      );
    }
    throw error;
  }
}
