import { z } from "zod";

export const workspaceIdParamsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const conversationIdParamsSchema = z.object({
  conversationId: z.string().uuid(),
});

const titleSchema = z.string().trim().min(1).max(200);

export const createConversationSchema = z.object({
  title: titleSchema.optional(),
});

export const updateConversationSchema = z.object({
  title: titleSchema,
});

export const listConversationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
