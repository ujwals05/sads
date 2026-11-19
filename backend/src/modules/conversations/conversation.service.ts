import { Prisma } from "../../generated/prisma/client.js";
import { ServiceError } from "../../utils/http.js";
import { workspaceRepository } from "../workspaces/workspace.repository.js";
import { requireMembership } from "../workspaces/workspace.service.js";
import type { WorkspaceRoleName } from "../workspaces/workspace.permissions.js";
import { conversationRepository } from "./conversation.repository.js";
import { assistantResponder } from "./assistant.responder.js";
import type {
  CreateConversationInput,
  SendMessageInput,
} from "./conversation.validation.js";

const conversationNotFound = () =>
  new ServiceError("CONVERSATION_NOT_FOUND", "Conversation not found.", 404);

function isPrismaError(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

type Conversation = NonNullable<
  Awaited<ReturnType<typeof conversationRepository.findById>>
>;

/**
 * Load a conversation the user is allowed to see.
 *  - Workspace conversation: the user must currently be a workspace member.
 *  - Personal conversation: the user must be its creator.
 * Anything else is reported as "not found" so IDs cannot be probed.
 */
async function loadAccessible(
  conversationId: string,
  userId: string,
): Promise<{ conversation: Conversation; role: WorkspaceRoleName | null }> {
  const conversation = await conversationRepository.findById(conversationId);
  if (!conversation) throw conversationNotFound();

  if (conversation.workspaceId) {
    const membership = await workspaceRepository.findMembership(
      conversation.workspaceId,
      userId,
    );
    if (!membership) throw conversationNotFound();
    return { conversation, role: membership.role as WorkspaceRoleName };
  }

  if (conversation.createdById !== userId) throw conversationNotFound();
  return { conversation, role: null };
}

/** Creator, or a workspace OWNER/ADMIN, may rename or delete a conversation. */
function canModify(
  conversation: Conversation,
  userId: string,
  role: WorkspaceRoleName | null,
): boolean {
  return (
    conversation.createdById === userId || role === "OWNER" || role === "ADMIN"
  );
}

function deriveTitle(content: string): string {
  const singleLine = content.replace(/\s+/g, " ").trim();
  return singleLine.length > 60 ? `${singleLine.slice(0, 57)}...` : singleLine;
}

export const conversationService = {
  async list(userId: string, workspaceId: string | undefined) {
    if (workspaceId) {
      await requireMembership(workspaceId, userId);
      return conversationRepository.listForWorkspace(workspaceId);
    }
    return conversationRepository.listPersonal(userId);
  },

  async create(userId: string, input: CreateConversationInput) {
    const workspaceId = input.workspaceId ?? null;
    if (workspaceId) {
      // Any member (including MEMBER) can start a workspace conversation.
      await requireMembership(workspaceId, userId);
    }
    return conversationRepository.create({
      workspaceId,
      createdById: userId,
      title: input.title ?? null,
    });
  },

  async get(conversationId: string, userId: string) {
    const { conversation } = await loadAccessible(conversationId, userId);
    const messages = await conversationRepository.listMessages(conversationId);
    return { ...conversation, messages };
  },

  async rename(conversationId: string, userId: string, title: string) {
    const { conversation, role } = await loadAccessible(conversationId, userId);
    if (!canModify(conversation, userId, role)) {
      throw new ServiceError(
        "FORBIDDEN",
        "Only the conversation creator or a workspace owner/admin can rename it.",
        403,
      );
    }
    return conversationRepository.updateTitle(conversationId, title);
  },

  async delete(conversationId: string, userId: string) {
    const { conversation, role } = await loadAccessible(conversationId, userId);
    if (!canModify(conversation, userId, role)) {
      throw new ServiceError(
        "FORBIDDEN",
        "Only the conversation creator or a workspace owner/admin can delete it.",
        403,
      );
    }
    try {
      await conversationRepository.delete(conversationId);
    } catch (error) {
      if (isPrismaError(error, "P2025")) throw conversationNotFound();
      throw error;
    }
  },

  async sendMessage(
    conversationId: string,
    userId: string,
    input: SendMessageInput,
  ) {
    await loadAccessible(conversationId, userId);

    const replay = async () => {
      if (!input.clientRequestId) return null;
      const [userMessage, assistantMessage, conversation] = await Promise.all([
        conversationRepository.findMessageByClientRequestId(
          conversationId,
          input.clientRequestId,
        ),
        conversationRepository.findMessageByClientRequestId(
          conversationId,
          `${input.clientRequestId}:assistant`,
        ),
        conversationRepository.findById(conversationId),
      ]);
      if (!userMessage || !conversation) return null;
      return { userMessage, assistantMessage, conversation };
    };

    // A retried request returns the original exchange instead of duplicating it.
    const existing = await replay();
    if (existing) return existing;

    const assistantContent = await assistantResponder.reply({
      content: input.content,
    });

    try {
      return await conversationRepository.appendExchange({
        conversationId,
        senderId: userId,
        userContent: input.content,
        assistantContent,
        clientRequestId: input.clientRequestId,
        titleIfMissing: deriveTitle(input.content),
      });
    } catch (error) {
      if (isPrismaError(error, "P2002")) {
        const raced = await replay();
        if (raced) return raced;
      }
      if (isPrismaError(error, "P2025")) throw conversationNotFound();
      throw error;
    }
  },
};
