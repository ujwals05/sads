import { prisma } from "../../db/prisma.js";
import { HttpError } from "../../utils/httpError.js";
import {
  AGENT_ROLES,
  requireConversationAccess,
  requireWorkspaceMember,
} from "./conversation.access.js";
import { toDisplayMessages } from "../agent/agent.transcript.js";
import { describeActiveTask } from "../agent/agent.service.js";

const conversationSummarySelect = {
  id: true,
  workspaceId: true,
  createdById: true,
  title: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const conversationService = {
  async list(workspaceId: string, userId: string, limit: number) {
    await requireWorkspaceMember(workspaceId, userId);

    return prisma.conversation.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: conversationSummarySelect,
    });
  },

  async create(workspaceId: string, userId: string, title?: string) {
    await requireWorkspaceMember(workspaceId, userId, AGENT_ROLES);

    return prisma.conversation.create({
      data: { workspaceId, createdById: userId, title: title ?? null },
      select: conversationSummarySelect,
    });
  },

  async get(conversationId: string, userId: string) {
    const { conversation } = await requireConversationAccess(
      conversationId,
      userId,
    );

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { sequence: "asc" },
    });

    return {
      conversation: {
        id: conversation.id,
        workspaceId: conversation.workspaceId,
        createdById: conversation.createdById,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      messages: toDisplayMessages(messages),
      activeTask: await describeActiveTask(conversationId),
    };
  },

  async rename(conversationId: string, userId: string, title: string) {
    const { conversation, membership } = await requireConversationAccess(
      conversationId,
      userId,
      AGENT_ROLES,
    );

    if (
      conversation.createdById !== userId &&
      membership.role !== "OWNER" &&
      membership.role !== "ADMIN"
    ) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Only the conversation creator or a workspace admin can rename it.",
      );
    }

    return prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
      select: conversationSummarySelect,
    });
  },

  async delete(conversationId: string, userId: string) {
    const { conversation, membership } = await requireConversationAccess(
      conversationId,
      userId,
    );

    if (
      conversation.createdById !== userId &&
      membership.role !== "OWNER" &&
      membership.role !== "ADMIN"
    ) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Only the conversation creator or a workspace admin can delete it.",
      );
    }

    await prisma.conversation.delete({ where: { id: conversationId } });
  },
};
