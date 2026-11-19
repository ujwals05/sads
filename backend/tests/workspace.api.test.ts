import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createFakeDb } from "./helpers/fakeDb.js";
import { startTestServer } from "./helpers/testServer.js";

type Server = Awaited<ReturnType<typeof startTestServer>>;
type Db = ReturnType<typeof createFakeDb>;

describe("Workspace & member management API", () => {
  let server: Server;
  let db: Db;
  let owner: { id: string; email: string };
  let admin: { id: string; email: string };
  let member: { id: string; email: string };
  let outsider: { id: string; email: string };
  let tokens: Record<"owner" | "admin" | "member" | "outsider", string>;
  let workspaceId: string;


  // Fresh app per test: isolates state and the in-memory rate limiter
  // (100 req/min per IP), which a whole suite would otherwise exceed.
  beforeEach(async () => {
    server = await startTestServer();
    db = createFakeDb();
    owner = db.addUser("owner@sads.dev");
    admin = db.addUser("admin@sads.dev");
    member = db.addUser("member@sads.dev");
    outsider = db.addUser("outsider@sads.dev");
    tokens = {
      owner: server.tokenFor(owner),
      admin: server.tokenFor(admin),
      member: server.tokenFor(member),
      outsider: server.tokenFor(outsider),
    };

    const created = await server.request("POST", "/workspaces", {
      token: tokens.owner,
      body: { name: "Core", description: "Main project" },
    });
    workspaceId = created.body.data.id;
    await server.request("POST", `/workspaces/${workspaceId}/members`, {
      token: tokens.owner,
      body: { userId: admin.id, role: "ADMIN" },
    });
    await server.request("POST", `/workspaces/${workspaceId}/members`, {
      token: tokens.owner,
      body: { userId: member.id, role: "MEMBER" },
    });
  });


  afterEach(async () => {
    db.restore();
    await server.close();
  });

  describe("authentication", () => {
    it("rejects requests without a token", async () => {
      const res = await server.request("GET", "/workspaces");
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, "UNAUTHENTICATED");
    });

    it("rejects an invalid token", async () => {
      const res = await server.request("GET", "/workspaces", { token: "not-a-jwt" });
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, "INVALID_TOKEN");
    });
  });

  describe("workspace CRUD", () => {
    it("creates a workspace and makes the creator OWNER", async () => {
      const res = await server.request("POST", "/workspaces", {
        token: tokens.member,
        body: { name: "  Side project  " },
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.name, "Side project");
      assert.equal(res.body.data.description, null);
      assert.equal(res.body.data.rootPath, null);
      assert.equal(res.body.data.role, "OWNER");
      assert.equal(db.roleOf(res.body.data.id, member.id), "OWNER");
    });

    it("validates input and rejects server-controlled fields", async () => {
      const empty = await server.request("POST", "/workspaces", {
        token: tokens.owner,
        body: { name: "   " },
      });
      assert.equal(empty.status, 400);
      assert.equal(empty.body.error.code, "VALIDATION_ERROR");

      const smuggled = await server.request("POST", "/workspaces", {
        token: tokens.owner,
        body: { name: "X", createdById: outsider.id },
      });
      assert.equal(smuggled.status, 400);

      const tooLong = await server.request("POST", "/workspaces", {
        token: tokens.owner,
        body: { name: "X", description: "d".repeat(501) },
      });
      assert.equal(tooLong.status, 400);
    });

    it("returns 400 for malformed JSON", async () => {
      const res = await server.request("POST", "/workspaces", {
        token: tokens.owner,
        rawBody: "{not json",
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, "INVALID_JSON");
    });

    it("lists only the caller's workspaces with their role and counts", async () => {
      const mine = await server.request("GET", "/workspaces", { token: tokens.admin });
      assert.equal(mine.status, 200);
      assert.equal(mine.body.data.length, 1);
      assert.equal(mine.body.data[0].role, "ADMIN");
      assert.equal(mine.body.data[0].memberCount, 3);

      const none = await server.request("GET", "/workspaces", { token: tokens.outsider });
      assert.deepEqual(none.body.data, []);
    });

    it("returns details with members and the caller's permissions", async () => {
      const res = await server.request("GET", `/workspaces/${workspaceId}`, { token: tokens.member });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.role, "MEMBER");
      assert.equal(res.body.data.members.length, 3);
      assert.deepEqual(res.body.data.permissions, {
        canUpdate: false,
        canDelete: false,
        assignableRoles: [],
      });
    });

    it("hides workspaces from non-members with 404, and rejects bad IDs", async () => {
      const res = await server.request("GET", `/workspaces/${workspaceId}`, { token: tokens.outsider });
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, "WORKSPACE_NOT_FOUND");

      const bad = await server.request("GET", "/workspaces/not-a-uuid", { token: tokens.owner });
      assert.equal(bad.status, 400);
    });

    it("lets OWNER and ADMIN update settings but not MEMBER or outsiders", async () => {
      const byAdmin = await server.request("PATCH", `/workspaces/${workspaceId}`, {
        token: tokens.admin,
        body: { description: "Updated by admin" },
      });
      assert.equal(byAdmin.status, 200);
      assert.equal(byAdmin.body.data.description, "Updated by admin");

      const cleared = await server.request("PATCH", `/workspaces/${workspaceId}`, {
        token: tokens.owner,
        body: { description: "" },
      });
      assert.equal(cleared.body.data.description, null);

      const byMember = await server.request("PATCH", `/workspaces/${workspaceId}`, {
        token: tokens.member,
        body: { name: "Hijacked" },
      });
      assert.equal(byMember.status, 403);

      const byOutsider = await server.request("PATCH", `/workspaces/${workspaceId}`, {
        token: tokens.outsider,
        body: { name: "Hijacked" },
      });
      assert.equal(byOutsider.status, 404);

      const emptyPatch = await server.request("PATCH", `/workspaces/${workspaceId}`, {
        token: tokens.owner,
        body: {},
      });
      assert.equal(emptyPatch.status, 400);
    });

    it("allows only the OWNER to delete the workspace", async () => {
      const byAdmin = await server.request("DELETE", `/workspaces/${workspaceId}`, { token: tokens.admin });
      assert.equal(byAdmin.status, 403);

      const byOwner = await server.request("DELETE", `/workspaces/${workspaceId}`, { token: tokens.owner });
      assert.equal(byOwner.status, 204);

      const after = await server.request("GET", `/workspaces/${workspaceId}`, { token: tokens.owner });
      assert.equal(after.status, 404);
    });
  });

  describe("members", () => {
    it("lists members for any member, but not for outsiders", async () => {
      const res = await server.request("GET", `/workspaces/${workspaceId}/members`, { token: tokens.member });
      assert.equal(res.status, 200);
      const roles = Object.fromEntries(res.body.data.map((m: any) => [m.user.email, m.role]));
      assert.deepEqual(roles, {
        "owner@sads.dev": "OWNER",
        "admin@sads.dev": "ADMIN",
        "member@sads.dev": "MEMBER",
      });

      const denied = await server.request("GET", `/workspaces/${workspaceId}/members`, { token: tokens.outsider });
      assert.equal(denied.status, 404);
    });

    it("adds an existing user, defaulting to MEMBER", async () => {
      const res = await server.request("POST", `/workspaces/${workspaceId}/members`, {
        token: tokens.admin,
        body: { userId: outsider.id },
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.role, "MEMBER");
      assert.equal(res.body.data.user.email, "outsider@sads.dev");
    });

    it("prevents duplicate memberships", async () => {
      const res = await server.request("POST", `/workspaces/${workspaceId}/members`, {
        token: tokens.owner,
        body: { userId: member.id, role: "MEMBER" },
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, "ALREADY_A_MEMBER");
    });

    it("returns 404 for unknown users and 400 for invalid payloads", async () => {
      const unknown = await server.request("POST", `/workspaces/${workspaceId}/members`, {
        token: tokens.owner,
        body: { userId: "00000000-0000-4000-8000-000000000000" },
      });
      assert.equal(unknown.status, 404);
      assert.equal(unknown.body.error.code, "USER_NOT_FOUND");

      const asOwner = await server.request("POST", `/workspaces/${workspaceId}/members`, {
        token: tokens.owner,
        body: { userId: outsider.id, role: "OWNER" },
      });
      assert.equal(asOwner.status, 400);
    });

    it("forbids MEMBER from adding members", async () => {
      const res = await server.request("POST", `/workspaces/${workspaceId}/members`, {
        token: tokens.member,
        body: { userId: outsider.id },
      });
      assert.equal(res.status, 403);
    });

    it("forbids outsiders from adding themselves", async () => {
      const res = await server.request("POST", `/workspaces/${workspaceId}/members`, {
        token: tokens.outsider,
        body: { userId: outsider.id, role: "ADMIN" },
      });
      assert.equal(res.status, 404);
      assert.equal(db.roleOf(workspaceId, outsider.id), null);
    });

    it("lets OWNER change ADMIN and MEMBER roles", async () => {
      const demote = await server.request("PATCH", `/workspaces/${workspaceId}/members/${admin.id}`, {
        token: tokens.owner,
        body: { role: "MEMBER" },
      });
      assert.equal(demote.status, 200);
      assert.equal(db.roleOf(workspaceId, admin.id), "MEMBER");
    });

    it("lets ADMIN promote a MEMBER but not modify the OWNER or another ADMIN", async () => {
      const promote = await server.request("PATCH", `/workspaces/${workspaceId}/members/${member.id}`, {
        token: tokens.admin,
        body: { role: "ADMIN" },
      });
      assert.equal(promote.status, 200);

      const touchAdmin = await server.request("PATCH", `/workspaces/${workspaceId}/members/${member.id}`, {
        token: tokens.admin,
        body: { role: "MEMBER" },
      });
      assert.equal(touchAdmin.status, 403);

      const touchOwner = await server.request("PATCH", `/workspaces/${workspaceId}/members/${owner.id}`, {
        token: tokens.admin,
        body: { role: "MEMBER" },
      });
      assert.equal(touchOwner.status, 403);
      assert.equal(db.roleOf(workspaceId, owner.id), "OWNER");
    });

    it("prevents privilege escalation by MEMBER and self role changes", async () => {
      const selfPromote = await server.request("PATCH", `/workspaces/${workspaceId}/members/${member.id}`, {
        token: tokens.member,
        body: { role: "ADMIN" },
      });
      assert.equal(selfPromote.status, 403);
      assert.equal(db.roleOf(workspaceId, member.id), "MEMBER");

      const ownerSelf = await server.request("PATCH", `/workspaces/${workspaceId}/members/${owner.id}`, {
        token: tokens.owner,
        body: { role: "MEMBER" },
      });
      assert.equal(ownerSelf.status, 403);

      const ownerRole = await server.request("PATCH", `/workspaces/${workspaceId}/members/${member.id}`, {
        token: tokens.owner,
        body: { role: "OWNER" },
      });
      assert.equal(ownerRole.status, 400);
    });

    it("returns 404 when changing the role of a non-member", async () => {
      const res = await server.request("PATCH", `/workspaces/${workspaceId}/members/${outsider.id}`, {
        token: tokens.owner,
        body: { role: "MEMBER" },
      });
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, "MEMBER_NOT_FOUND");
    });

    it("enforces removal boundaries", async () => {
      const adminRemovesOwner = await server.request("DELETE", `/workspaces/${workspaceId}/members/${owner.id}`, {
        token: tokens.admin,
      });
      assert.equal(adminRemovesOwner.status, 403);

      const memberRemovesAdmin = await server.request("DELETE", `/workspaces/${workspaceId}/members/${admin.id}`, {
        token: tokens.member,
      });
      assert.equal(memberRemovesAdmin.status, 403);

      const ownerLeaves = await server.request("DELETE", `/workspaces/${workspaceId}/members/${owner.id}`, {
        token: tokens.owner,
      });
      assert.equal(ownerLeaves.status, 403);

      const adminRemovesMember = await server.request("DELETE", `/workspaces/${workspaceId}/members/${member.id}`, {
        token: tokens.admin,
      });
      assert.equal(adminRemovesMember.status, 204);
      assert.equal(db.roleOf(workspaceId, member.id), null);

      const ownerRemovesAdmin = await server.request("DELETE", `/workspaces/${workspaceId}/members/${admin.id}`, {
        token: tokens.owner,
      });
      assert.equal(ownerRemovesAdmin.status, 204);
    });

    it("lets a MEMBER leave and immediately lose access", async () => {
      const leave = await server.request("DELETE", `/workspaces/${workspaceId}/members/${member.id}`, {
        token: tokens.member,
      });
      assert.equal(leave.status, 204);

      const after = await server.request("GET", `/workspaces/${workspaceId}`, { token: tokens.member });
      assert.equal(after.status, 404);
    });

    it("transfers ownership atomically (OWNER only)", async () => {
      const byAdmin = await server.request("POST", `/workspaces/${workspaceId}/transfer-ownership`, {
        token: tokens.admin,
        body: { userId: admin.id },
      });
      assert.equal(byAdmin.status, 403);

      const toOutsider = await server.request("POST", `/workspaces/${workspaceId}/transfer-ownership`, {
        token: tokens.owner,
        body: { userId: outsider.id },
      });
      assert.equal(toOutsider.status, 404);

      const ok = await server.request("POST", `/workspaces/${workspaceId}/transfer-ownership`, {
        token: tokens.owner,
        body: { userId: member.id },
      });
      assert.equal(ok.status, 200);
      assert.equal(db.roleOf(workspaceId, member.id), "OWNER");
      assert.equal(db.roleOf(workspaceId, owner.id), "ADMIN");

      // The former owner can no longer delete the workspace.
      const del = await server.request("DELETE", `/workspaces/${workspaceId}`, { token: tokens.owner });
      assert.equal(del.status, 403);
    });
  });

  describe("user search (existing endpoint)", () => {
    it("excludes existing members when a workspace is given", async () => {
      const res = await server.request(
        "GET",
        `/users/search?q=sads.dev&workspaceId=${workspaceId}`,
        { token: tokens.admin },
      );
      assert.equal(res.status, 200);
      assert.deepEqual(
        res.body.data.map((u: any) => u.email),
        ["outsider@sads.dev"],
      );
    });

    it("refuses the workspace filter to non-managers and outsiders", async () => {
      const asMember = await server.request(
        "GET",
        `/users/search?q=sads&workspaceId=${workspaceId}`,
        { token: tokens.member },
      );
      assert.equal(asMember.status, 403);

      const asOutsider = await server.request(
        "GET",
        `/users/search?q=sads&workspaceId=${workspaceId}`,
        { token: tokens.outsider },
      );
      assert.equal(asOutsider.status, 404);
    });

    it("still supports plain search and validates the query", async () => {
      const plain = await server.request("GET", "/users/search?q=admin", { token: tokens.member });
      assert.equal(plain.status, 200);
      assert.equal(plain.body.data[0].email, "admin@sads.dev");

      const empty = await server.request("GET", "/users/search?q=", { token: tokens.member });
      assert.equal(empty.status, 400);
    });
  });
});
