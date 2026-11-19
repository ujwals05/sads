import { userRepository } from "./user.repository.js";
import type { SearchUsersInput } from "./user.validation.js";
import {
  WorkspaceServiceError,
  requireMembership,
} from "../workspaces/workspace.service.js";
import { canManageMembers } from "../workspaces/workspace.permissions.js";

export const userService = {
  async getById(id: string) {
    return userRepository.findById(id);
  },

  /**
   * Search registered users by email.
   *
   * When `workspaceId` is supplied the results exclude existing members of
   * that workspace (used by the "add member" dialog). Because that filter
   * reveals who is in the workspace, the requester must be an OWNER/ADMIN of
   * it; otherwise anyone could probe the membership of arbitrary workspaces.
   */
  async search(requesterId: string, input: SearchUsersInput) {
    if (input.workspaceId) {
      const membership = await requireMembership(input.workspaceId, requesterId);
      if (!canManageMembers(membership.role)) {
        throw new WorkspaceServiceError(
          "FORBIDDEN",
          "Only the workspace owner or an admin can search for users to add.",
          403,
        );
      }
    }

    return userRepository.searchUsers(input);
  },
};
