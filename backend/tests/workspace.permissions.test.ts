import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assignableRolesFor,
  canAccessWorkspace,
  canDeleteWorkspace,
  canManageMembers,
  canUpdateWorkspace,
  checkAddMember,
  checkChangeRole,
  checkRemoveMember,
  checkTransferOwnership,
} from "../src/modules/workspaces/workspace.permissions.js";

const A = "actor";
const T = "target";

describe("workspace permission policy", () => {
  it("grants management and settings only to OWNER and ADMIN", () => {
    assert.equal(canManageMembers("OWNER"), true);
    assert.equal(canManageMembers("ADMIN"), true);
    assert.equal(canManageMembers("MEMBER"), false);
    assert.equal(canUpdateWorkspace("MEMBER"), false);
    assert.equal(canDeleteWorkspace("OWNER"), true);
    assert.equal(canDeleteWorkspace("ADMIN"), false);
  });

  it("lets every member, and only members, access the workspace", () => {
    assert.equal(canAccessWorkspace("MEMBER"), true);
    assert.equal(canAccessWorkspace(null), false);
    assert.equal(canAccessWorkspace(undefined), false);
  });

  it("never lets anyone grant OWNER, and caps grants at the actor's rank", () => {
    assert.deepEqual(assignableRolesFor("OWNER"), ["ADMIN", "MEMBER"]);
    assert.deepEqual(assignableRolesFor("ADMIN"), ["ADMIN", "MEMBER"]);
    assert.deepEqual(assignableRolesFor("MEMBER"), []);
    assert.equal(checkAddMember("MEMBER", "MEMBER").allowed, false);
    assert.equal(checkAddMember("ADMIN", "MEMBER").allowed, true);
    assert.equal(checkAddMember("OWNER", "ADMIN").allowed, true);
    // @ts-expect-error OWNER is not an assignable role at the type level either
    assert.equal(checkAddMember("OWNER", "OWNER").allowed, false);
  });

  describe("role changes", () => {
    const change = (actorRole: any, targetRole: any, newRole: any, same = false) =>
      checkChangeRole({ actorId: A, actorRole, targetId: same ? A : T, targetRole, newRole }).allowed;

    it("OWNER can promote and demote ADMIN/MEMBER", () => {
      assert.equal(change("OWNER", "MEMBER", "ADMIN"), true);
      assert.equal(change("OWNER", "ADMIN", "MEMBER"), true);
    });

    it("ADMIN can only change members ranked below them", () => {
      assert.equal(change("ADMIN", "MEMBER", "ADMIN"), true);
      assert.equal(change("ADMIN", "ADMIN", "MEMBER"), false);
      assert.equal(change("ADMIN", "OWNER", "MEMBER"), false);
    });

    it("nobody can change the OWNER's role or their own role", () => {
      assert.equal(change("OWNER", "OWNER", "ADMIN"), false);
      assert.equal(change("OWNER", "OWNER", "MEMBER", true), false);
      assert.equal(change("ADMIN", "ADMIN", "MEMBER", true), false);
    });

    it("MEMBER cannot change anyone's role", () => {
      assert.equal(change("MEMBER", "MEMBER", "ADMIN"), false);
    });
  });

  describe("removal", () => {
    const remove = (actorRole: any, targetRole: any, same = false) =>
      checkRemoveMember({ actorId: A, actorRole, targetId: same ? A : T, targetRole }).allowed;

    it("OWNER can remove ADMIN and MEMBER but is never removable", () => {
      assert.equal(remove("OWNER", "ADMIN"), true);
      assert.equal(remove("OWNER", "MEMBER"), true);
      assert.equal(remove("ADMIN", "OWNER"), false);
    });

    it("ADMIN can remove MEMBER but not another ADMIN", () => {
      assert.equal(remove("ADMIN", "MEMBER"), true);
      assert.equal(remove("ADMIN", "ADMIN"), false);
    });

    it("MEMBER cannot remove others but can leave", () => {
      assert.equal(remove("MEMBER", "MEMBER"), false);
      assert.equal(remove("MEMBER", "MEMBER", true), true);
      assert.equal(remove("ADMIN", "ADMIN", true), true);
    });

    it("OWNER cannot leave", () => {
      assert.equal(remove("OWNER", "OWNER", true), false);
    });
  });

  it("only the OWNER can transfer ownership, and not to themselves", () => {
    assert.equal(checkTransferOwnership({ actorId: A, actorRole: "OWNER", targetId: T }).allowed, true);
    assert.equal(checkTransferOwnership({ actorId: A, actorRole: "ADMIN", targetId: T }).allowed, false);
    assert.equal(checkTransferOwnership({ actorId: A, actorRole: "OWNER", targetId: A }).allowed, false);
  });
});
