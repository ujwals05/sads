import { z } from "zod";

export const taskIdParamsSchema = z.object({
  taskId: z.string().uuid(),
});

export const startTurnSchema = z.object({
  text: z.string().trim().min(1).max(20_000),
  // Idempotency key from the client: a retried request cannot post twice.
  clientRequestId: z.string().trim().min(1).max(100),
  // Snapshot of the open project, used on the first turn of a conversation.
  projectContext: z.string().max(20_000).optional(),
});

export const toolResultsSchema = z.object({
  results: z
    .array(
      z.object({
        toolUseId: z.string().min(1).max(200),
        content: z.string().max(400_000),
        isError: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(50),
});
