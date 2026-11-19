import { describe, expect, it } from 'vitest';
import {
  assignableRolesFor,
  canChangeRoleOf,
  canManageMembers,
  canModifyConversation,
  canRemove,
  canUpdateWorkspace,
} from './permissions.ts';
// The backend policy is the source of truth; the UI mirror must agree with it.
import * as backend from '../../../../backend/src/modules/workspaces/workspace.permissions.ts';
import type { WorkspaceRole } from '../types/workspace.ts';

const ROLES: WorkspaceRole[] = ['OWNER', 'ADMIN', 'MEMBER'];

describe('UI permission helpers', () => {
  it('only lets OWNER/ADMIN manage members and settings', () => {
    expect(canManageMembers('OWNER')).toBe(true);
    expect(canManageMembers('ADMIN')).toBe(true);
    expect(canManageMembers('MEMBER')).toBe(false);
    expect(canManageMembers(null)).toBe(false);
    expect(canUpdateWorkspace('MEMBER')).toBe(false);
  });

  it('hides role controls for the owner row and for self', () => {
    const owner = { userId: 'o', role: 'OWNER' as const };
    expect(canChangeRoleOf(owner, { userId: 'o', role: 'OWNER' })).toBe(false);
    expect(canChangeRoleOf(owner, { userId: 'a', role: 'ADMIN' })).toBe(true);
    const admin = { userId: 'a', role: 'ADMIN' as const };
    expect(canChangeRoleOf(admin, { userId: 'a2', role: 'ADMIN' })).toBe(false);
    expect(canChangeRoleOf(admin, { userId: 'o', role: 'OWNER' })).toBe(false);
    expect(canChangeRoleOf(admin, { userId: 'm', role: 'MEMBER' })).toBe(true);
  });

  it('lets non-owners leave but never the owner', () => {
    expect(canRemove({ userId: 'm', role: 'MEMBER' }, { userId: 'm', role: 'MEMBER' })).toBe(true);
    expect(canRemove({ userId: 'o', role: 'OWNER' }, { userId: 'o', role: 'OWNER' })).toBe(false);
  });

  it('allows conversation edits by creator or workspace managers only', () => {
    const wsChat = { createdById: 'creator', workspaceId: 'ws' };
    expect(canModifyConversation('creator', wsChat, 'MEMBER')).toBe(true);
    expect(canModifyConversation('other', wsChat, 'MEMBER')).toBe(false);
    expect(canModifyConversation('other', wsChat, 'ADMIN')).toBe(true);
    // Personal chats: only the creator, regardless of any workspace role.
    const personal = { createdById: 'creator', workspaceId: null };
    expect(canModifyConversation('other', personal, 'OWNER')).toBe(false);
  });
});

describe('UI policy matches the backend policy', () => {
  it('assignable roles', () => {
    for (const role of ROLES) {
      expect(assignableRolesFor(role)).toEqual(backend.assignableRolesFor(role));
    }
  });

  it('role-change and removal decisions for every actor/target combination', () => {
    for (const actorRole of ROLES) {
      for (const targetRole of ROLES) {
        for (const same of [false, true]) {
          if (same && actorRole !== targetRole) continue;
          const actor = { userId: 'actor', role: actorRole };
          const target = { userId: same ? 'actor' : 'target', role: targetRole };

          const backendRemove = backend.checkRemoveMember({
            actorId: actor.userId,
            actorRole,
            targetId: target.userId,
            targetRole,
          }).allowed;
          expect(canRemove(actor, target), `remove ${actorRole}->${targetRole} self=${same}`).toBe(
            backendRemove,
          );

          // The UI shows the role control if *some* grantable role is allowed.
          const backendChange = backend.ASSIGNABLE_ROLES.some(
            (newRole) =>
              backend.checkChangeRole({
                actorId: actor.userId,
                actorRole,
                targetId: target.userId,
                targetRole,
                newRole,
              }).allowed,
          );
          expect(canChangeRoleOf(actor, target), `change ${actorRole}->${targetRole} self=${same}`).toBe(
            backendChange,
          );
        }
      }
    }
  });
});
