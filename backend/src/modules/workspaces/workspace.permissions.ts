/**
 * Workspace authorization policy.
 *
 * Pure functions only (no I/O) so the rules can be unit tested exhaustively
 * and reused by every service that needs a workspace permission decision.
 *
 * Model: roles are ranked OWNER > ADMIN > MEMBER.
 *  - Only OWNER and ADMIN may manage members.
 *  - An actor may only act on members ranked strictly below themselves
 *    (an ADMIN can never touch another ADMIN or the OWNER).
 *  - An actor may only grant roles up to their own rank, and the OWNER role
 *    can never be granted through add/role-change: it moves exclusively via
 *    an explicit ownership transfer performed by the current OWNER.
 *  - Nobody changes their own role (prevents self-escalation and an
 *    accidental owner-less workspace).
 */

export const WORKSPACE_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
export type WorkspaceRoleName = (typeof WORKSPACE_ROLES)[number];

/** Roles that can be granted through add-member / change-role. */
export const ASSIGNABLE_ROLES = ["ADMIN", "MEMBER"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const RANK: Record<WorkspaceRoleName, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
};

export type PermissionDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

const allow: PermissionDecision = { allowed: true };
const deny = (reason: string): PermissionDecision => ({
  allowed: false,
  reason,
});

export function roleRank(role: WorkspaceRoleName): number {
  return RANK[role];
}

export function canManageMembers(role: WorkspaceRoleName): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canUpdateWorkspace(role: WorkspaceRoleName): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canDeleteWorkspace(role: WorkspaceRoleName): boolean {
  return role === "OWNER";
}

export function canTransferOwnership(role: WorkspaceRoleName): boolean {
  return role === "OWNER";
}

/** Any workspace member may read the workspace and its conversations. */
export function canAccessWorkspace(
  role: WorkspaceRoleName | null | undefined,
): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MEMBER";
}

/** Roles the actor is allowed to hand out. */
export function assignableRolesFor(
  actorRole: WorkspaceRoleName,
): AssignableRole[] {
  if (!canManageMembers(actorRole)) return [];
  return ASSIGNABLE_ROLES.filter((r) => RANK[r] <= RANK[actorRole]);
}

export function checkAddMember(
  actorRole: WorkspaceRoleName,
  newRole: AssignableRole,
): PermissionDecision {
  if (!canManageMembers(actorRole)) {
    return deny("You do not have permission to add members to this workspace.");
  }
  if (!assignableRolesFor(actorRole).includes(newRole)) {
    return deny(`You cannot grant the ${newRole} role.`);
  }
  return allow;
}

export function checkChangeRole(input: {
  actorId: string;
  actorRole: WorkspaceRoleName;
  targetId: string;
  targetRole: WorkspaceRoleName;
  newRole: AssignableRole;
}): PermissionDecision {
  const { actorId, actorRole, targetId, targetRole, newRole } = input;

  if (!canManageMembers(actorRole)) {
    return deny("You do not have permission to change member roles.");
  }
  if (actorId === targetId) {
    return deny("You cannot change your own role.");
  }
  if (targetRole === "OWNER") {
    return deny(
      "The workspace owner's role cannot be changed. Use ownership transfer instead.",
    );
  }
  if (RANK[targetRole] >= RANK[actorRole]) {
    return deny("You can only change the role of members ranked below you.");
  }
  if (!assignableRolesFor(actorRole).includes(newRole)) {
    return deny(`You cannot grant the ${newRole} role.`);
  }
  return allow;
}

export function checkRemoveMember(input: {
  actorId: string;
  actorRole: WorkspaceRoleName;
  targetId: string;
  targetRole: WorkspaceRoleName;
}): PermissionDecision {
  const { actorId, actorRole, targetId, targetRole } = input;

  // Leaving a workspace.
  if (actorId === targetId) {
    if (targetRole === "OWNER") {
      return deny(
        "The workspace owner cannot leave. Transfer ownership or delete the workspace instead.",
      );
    }
    return allow;
  }

  if (!canManageMembers(actorRole)) {
    return deny("You do not have permission to remove members from this workspace.");
  }
  if (targetRole === "OWNER") {
    return deny("The workspace owner cannot be removed.");
  }
  if (RANK[targetRole] >= RANK[actorRole]) {
    return deny("You can only remove members ranked below you.");
  }
  return allow;
}

export function checkTransferOwnership(input: {
  actorId: string;
  actorRole: WorkspaceRoleName;
  targetId: string;
}): PermissionDecision {
  if (!canTransferOwnership(input.actorRole)) {
    return deny("Only the workspace owner can transfer ownership.");
  }
  if (input.actorId === input.targetId) {
    return deny("You already own this workspace.");
  }
  return allow;
}
