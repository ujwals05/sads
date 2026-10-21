
import { z } from "zod";

export const searchUsersSchema = z.object({
  q: z.string().trim().min(1, "Search query is required.").max(254),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  workspaceId: z.string().uuid().optional(),
});

export type SearchUsersInput = z.infer<typeof searchUsersSchema>;
