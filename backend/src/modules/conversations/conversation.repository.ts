import { prisma } from "../../db/prisma.js";

const conversationSelect = {
  id: true,
  workspaceId: true,
  createdById: true,
  title: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, email: true } },
} as const;

const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  role: true,
  content: true,
  clientRequestId: true,
  createdAt: true,
  sender: { select: { id: true, email: true } },
} as const;

/** Most recent N messages are returned when opening a conversation. */
export const MESSAGE_HISTORY_LIMIT = 200;

export const conversationRepository = {
  listForWorkspace(workspaceId: string) {
    return prisma.conversation.findMany({
      where: { workspaceId },
      select: { ...conversationSelect, _count: { select: { messages: true } } },
      orderBy: { updatedAt: "desc" },
    });
  },

  listPersonal(userId: string) {
    return prisma.conversation.findMany({
      where: { workspaceId: null, createdById: userId },
      select: { ...conversationSelect, _count: { select: { messages: true } } },
      orderBy: { updatedAt: "desc" },
    });
  },

  findById(conversationId: string) {
    return prisma.conversation.findUnique({
      where: { id: conversationId },
      select: conversationSelect,
    });
  },

  async listMessages(conversationId: string) {
    const latest = await prisma.message.findMany({
      where: { conversationId },
      select: messageSelect,
      orderBy: { createdAt: "desc" },
      take: MESSAGE_HISTORY_LIMIT,
    });
    return latest.reverse();
  },

  create(input: {
    workspaceId: string | null;
    createdById: string;
    title: string | null;
  }) {
    return prisma.conversation.create({
      data: input,
      select: conversationSelect,
    });
  },

  updateTitle(conversationId: string, title: string) {
    return prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
      select: conversationSelect,
    });
  },

  delete(conversationId: string) {
    return prisma.conversation.delete({
      where: { id: conversationId },
      select: { id: true },
    });
  },

  findMessageByClientRequestId(conversationId: string, clientRequestId: string) {
    return prisma.message.findUnique({
      where: {
        conversationId_clientRequestId: { conversationId, clientRequestId },
      },
      select: messageSelect,
    });
  },

  /**
   * Store the user's message and the assistant reply together and bump the
   * conversation's updatedAt (and give it a title if it has none yet).
   */
  appendExchange(input: {
    conversationId: string;
    senderId: string;
    userContent: string;
    assistantContent: string;
    clientRequestId?: string;
    titleIfMissing: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const userMessage = await tx.message.create({
        data: {
          conversationId: input.conversationId,
          senderId: input.senderId,
          role: "USER",
          content: input.userContent,
          clientRequestId: input.clientRequestId ?? null,
        },
        select: messageSelect,
      });

      const assistantMessage = await tx.message.create({
        data: {
          conversationId: input.conversationId,
          senderId: null,
          role: "ASSISTANT",
          content: input.assistantContent,
          clientRequestId: input.clientRequestId
            ? `${input.clientRequestId}:assistant`
            : null,
        },
        select: messageSelect,
      });

      await tx.conversation.updateMany({
        where: { id: input.conversationId, title: null },
        data: { title: input.titleIfMissing },
      });

      const conversation = await tx.conversation.update({
        where: { id: input.conversationId },
        data: { updatedAt: new Date() },
        select: conversationSelect,
      });

      return { userMessage, assistantMessage, conversation };
    });
  },
};
