import type {
  AssignableRole,
  WorkspaceMember,
  WorkspaceRole,
} from '../types/workspace.ts';

/**
 * UI-side mirror of the backend policy (backend/src/modules/workspaces/
 * workspace.permissions.ts). It only decides which controls to show; every
 * action is authorized again by the backend.
 */
const RANK: Record<WorkspaceRole, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1 };

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
};

export function canManageMembers(role: WorkspaceRole | null | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function canUpdateWorkspace(role: WorkspaceRole | null | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function assignableRolesFor(
  role: WorkspaceRole | null | undefined,
): AssignableRole[] {
  if (!role || !canManageMembers(role)) return [];
  return (['ADMIN', 'MEMBER'] as const).filter((r) => RANK[r] <= RANK[role]);
}

/** Actor may change the target's role (never self, never OWNER, only lower ranks). */
export function canChangeRoleOf(
  actor: { userId: string; role: WorkspaceRole },
  target: Pick<WorkspaceMember, 'userId' | 'role'>,
): boolean {
  return (
    canManageMembers(actor.role) &&
    actor.userId !== target.userId &&
    target.role !== 'OWNER' &&
    RANK[target.role] < RANK[actor.role]
  );
}

/** Actor may remove the target (or leave, if target is self and not OWNER). */
export function canRemove(
  actor: { userId: string; role: WorkspaceRole },
  target: Pick<WorkspaceMember, 'userId' | 'role'>,
): boolean {
  if (actor.userId === target.userId) return target.role !== 'OWNER';
  return (
    canManageMembers(actor.role) &&
    target.role !== 'OWNER' &&
    RANK[target.role] < RANK[actor.role]
  );
}

/** Creator, or a workspace OWNER/ADMIN, may rename/delete a conversation. */
export function canModifyConversation(
  userId: string,
  conversation: { createdById: string; workspaceId: string | null },
  workspaceRole: WorkspaceRole | null | undefined,
): boolean {
  if (conversation.createdById === userId) return true;
  return conversation.workspaceId !== null && canManageMembers(workspaceRole);
}
