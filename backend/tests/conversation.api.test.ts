import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createFakeDb } from "./helpers/fakeDb.js";
import { startTestServer } from "./helpers/testServer.js";

type Server = Awaited<ReturnType<typeof startTestServer>>;

describe("Workspace-scoped conversations API", () => {
  let server: Server;
  let db: ReturnType<typeof createFakeDb>;
  let t: Record<"owner" | "member" | "outsider", string>;
  let ids: Record<"owner" | "member" | "outsider", string>;
  let workspaceId: string;
  let otherWorkspaceId: string;


  // Fresh app per test: isolates state and the in-memory rate limiter
  // (100 req/min per IP), which a whole suite would otherwise exceed.
  beforeEach(async () => {
    server = await startTestServer();
    db = createFakeDb();
    const owner = db.addUser("owner@sads.dev");
    const member = db.addUser("member@sads.dev");
    const outsider = db.addUser("outsider@sads.dev");
    ids = { owner: owner.id, member: member.id, outsider: outsider.id };
    t = {
      owner: server.tokenFor(owner),
      member: server.tokenFor(member),
      outsider: server.tokenFor(outsider),
    };
    workspaceId = (
      await server.request("POST", "/workspaces", { token: t.owner, body: { name: "Core" } })
    ).body.data.id;
    otherWorkspaceId = (
      await server.request("POST", "/workspaces", { token: t.outsider, body: { name: "Other" } })
    ).body.data.id;
    await server.request("POST", `/workspaces/${workspaceId}/members`, {
      token: t.owner,
      body: { userId: member.id },
    });
  });

  afterEach(async () => {
    db.restore();
    await server.close();
  });

  async function createChat(token: string, body: unknown) {
    return server.request("POST", "/conversations", { token, body });
  }

  it("creates multiple sessions in a workspace, visible to every member", async () => {
    const a = await createChat(t.owner, { workspaceId });
    const b = await createChat(t.member, { workspaceId, title: "Member chat" });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.equal(a.body.data.workspaceId, workspaceId);

    const list = await server.request("GET", `/conversations?workspaceId=${workspaceId}`, { token: t.member });
    assert.equal(list.status, 200);
    assert.equal(list.body.data.length, 2);

    const ws = await server.request("GET", "/workspaces", { token: t.owner });
    assert.equal(ws.body.data[0].conversationCount, 2);
  });

  it("blocks outsiders from listing, creating, reading or posting", async () => {
    const chat = (await createChat(t.owner, { workspaceId })).body.data;

    const list = await server.request("GET", `/conversations?workspaceId=${workspaceId}`, { token: t.outsider });
    assert.equal(list.status, 404);

    const create = await createChat(t.outsider, { workspaceId });
    assert.equal(create.status, 404);

    const read = await server.request("GET", `/conversations/${chat.id}`, { token: t.outsider });
    assert.equal(read.status, 404);
    assert.equal(read.body.error.code, "CONVERSATION_NOT_FOUND");

    const post = await server.request("POST", `/conversations/${chat.id}/messages`, {
      token: t.outsider,
      body: { content: "hi" },
    });
    assert.equal(post.status, 404);
  });

  it("does not leak chats across workspaces", async () => {
    await createChat(t.outsider, { workspaceId: otherWorkspaceId });
    const list = await server.request("GET", `/conversations?workspaceId=${workspaceId}`, { token: t.owner });
    assert.equal(list.body.data.length, 0);
  });

  it("stores the exchange, titles the chat, and continues it later", async () => {
    const chat = (await createChat(t.member, { workspaceId })).body.data;
    assert.equal(chat.title, null);

    const first = await server.request("POST", `/conversations/${chat.id}/messages`, {
      token: t.member,
      body: { content: "Add a JSON schema validator", clientRequestId: "req-1" },
    });
    assert.equal(first.status, 201);
    assert.equal(first.body.data.userMessage.role, "USER");
    assert.equal(first.body.data.userMessage.senderId, ids.member);
    assert.equal(first.body.data.assistantMessage.role, "ASSISTANT");
    assert.equal(first.body.data.conversation.title, "Add a JSON schema validator");

    // The owner continues the same conversation.
    await server.request("POST", `/conversations/${chat.id}/messages`, {
      token: t.owner,
      body: { content: "Prefer a maintained package" },
    });

    const full = await server.request("GET", `/conversations/${chat.id}`, { token: t.owner });
    assert.equal(full.status, 200);
    assert.deepEqual(
      full.body.data.messages.map((m: any) => m.role),
      ["USER", "ASSISTANT", "USER", "ASSISTANT"],
    );
  });

  it("is idempotent for retried messages", async () => {
    const chat = (await createChat(t.owner, { workspaceId })).body.data;
    const body = { content: "Hello", clientRequestId: "retry-1" };
    const a = await server.request("POST", `/conversations/${chat.id}/messages`, { token: t.owner, body });
    const b = await server.request("POST", `/conversations/${chat.id}/messages`, { token: t.owner, body });
    assert.equal(a.body.data.userMessage.id, b.body.data.userMessage.id);

    const full = await server.request("GET", `/conversations/${chat.id}`, { token: t.owner });
    assert.equal(full.body.data.messages.length, 2);
  });

  it("does not let clients author assistant messages", async () => {
    const chat = (await createChat(t.owner, { workspaceId })).body.data;
    const res = await server.request("POST", `/conversations/${chat.id}/messages`, {
      token: t.owner,
      body: { content: "x", role: "ASSISTANT" },
    });
    assert.equal(res.status, 400);
  });

  it("loses access to workspace chats after removal from the workspace", async () => {
    const chat = (await createChat(t.member, { workspaceId })).body.data;
    await server.request("DELETE", `/workspaces/${workspaceId}/members/${ids.member}`, { token: t.owner });

    const read = await server.request("GET", `/conversations/${chat.id}`, { token: t.member });
    assert.equal(read.status, 404);
  });

  it("restricts rename/delete to the creator or workspace OWNER/ADMIN", async () => {
    const ownerChat = (await createChat(t.owner, { workspaceId })).body.data;
    const memberChat = (await createChat(t.member, { workspaceId })).body.data;

    const memberRenamesOwner = await server.request("PATCH", `/conversations/${ownerChat.id}`, {
      token: t.member,
      body: { title: "mine now" },
    });
    assert.equal(memberRenamesOwner.status, 403);

    const memberRenamesOwn = await server.request("PATCH", `/conversations/${memberChat.id}`, {
      token: t.member,
      body: { title: "Renamed" },
    });
    assert.equal(memberRenamesOwn.status, 200);
    assert.equal(memberRenamesOwn.body.data.title, "Renamed");

    const ownerDeletesMember = await server.request("DELETE", `/conversations/${memberChat.id}`, {
      token: t.owner,
    });
    assert.equal(ownerDeletesMember.status, 204);
  });

  describe("personal chats (no workspace)", () => {
    it("are private to their creator", async () => {
      const mine = await createChat(t.member, {});
      assert.equal(mine.status, 201);
      assert.equal(mine.body.data.workspaceId, null);

      const myList = await server.request("GET", "/conversations", { token: t.member });
      assert.equal(myList.body.data.length, 1);

      const theirList = await server.request("GET", "/conversations", { token: t.owner });
      assert.equal(theirList.body.data.length, 0);

      const peek = await server.request("GET", `/conversations/${mine.body.data.id}`, { token: t.owner });
      assert.equal(peek.status, 404);
    });

    it("are not mixed into workspace listings", async () => {
      await createChat(t.owner, {});
      await createChat(t.owner, { workspaceId });
      const ws = await server.request("GET", `/conversations?workspaceId=${workspaceId}`, { token: t.owner });
      assert.equal(ws.body.data.length, 1);
      const personal = await server.request("GET", "/conversations", { token: t.owner });
      assert.equal(personal.body.data.length, 1);
    });
  });

  it("validates IDs and payloads", async () => {
    const badId = await server.request("GET", "/conversations/123", { token: t.owner });
    assert.equal(badId.status, 400);

    const badFilter = await server.request("GET", "/conversations?workspaceId=nope", { token: t.owner });
    assert.equal(badFilter.status, 400);

    const chat = (await createChat(t.owner, { workspaceId })).body.data;
    const blank = await server.request("POST", `/conversations/${chat.id}/messages`, {
      token: t.owner,
      body: { content: "   " },
    });
    assert.equal(blank.status, 400);
  });
});
