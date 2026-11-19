import { z } from "zod";

const uuidSchema = z.string().uuid();

const titleSchema = z
  .string()
  .trim()
  .min(1, "Title is required.")
  .max(120, "Title must not exceed 120 characters.");

/** No workspaceId => the caller's personal conversations. */
export const listConversationsQuerySchema = z.object({
  workspaceId: uuidSchema.optional(),
});

export const createConversationSchema = z
  .object({
    workspaceId: uuidSchema.nullable().optional(),
    title: titleSchema.optional(),
  })
  .strict();

export const conversationParamsSchema = z.object({
  conversationId: uuidSchema,
});

export const updateConversationSchema = z
  .object({
    title: titleSchema,
  })
  .strict();

export const sendMessageSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1, "Message content is required.")
      .max(20_000, "Message must not exceed 20,000 characters."),
    // Lets clients retry safely: the same id is never stored twice.
    clientRequestId: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[A-Za-z0-9_-]+$/, "Invalid client request id.")
      .optional(),
  })
  .strict();

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
