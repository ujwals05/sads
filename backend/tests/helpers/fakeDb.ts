/**
 * In-memory stand-in for the Prisma-backed repositories.
 *
 * It replaces the methods on the exported repository objects, so the real
 * routes, middleware, controllers, services and permission rules all run
 * unchanged. Only the persistence layer is faked.
 */
import { randomUUID } from "node:crypto";
import { Prisma } from "../../src/generated/prisma/client.js";
import { authRepository } from "../../src/modules/auth/auth.repository.js";
import { userRepository } from "../../src/modules/users/user.repository.js";
import { workspaceRepository } from "../../src/modules/workspaces/workspace.repository.js";
import { conversationRepository } from "../../src/modules/conversations/conversation.repository.js";

type Role = "OWNER" | "ADMIN" | "MEMBER";

interface UserRow { id: string; email: string; createdAt: Date }
interface WorkspaceRow {
  id: string; name: string; description: string | null; rootPath: string | null;
  createdById: string; createdAt: Date; updatedAt: Date;
}
interface MemberRow { workspaceId: string; userId: string; role: Role; joinedAt: Date }
interface ConversationRow {
  id: string; workspaceId: string | null; createdById: string; title: string | null;
  createdAt: Date; updatedAt: Date;
}
interface MessageRow {
  id: string; conversationId: string; senderId: string | null;
  role: "USER" | "ASSISTANT"; content: string; clientRequestId: string | null; createdAt: Date;
}

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(`Fake ${code}`, {
    code,
    clientVersion: "test",
  });

let clock = Date.parse("2026-11-01T00:00:00Z");
const now = () => new Date((clock += 1000));

export function createFakeDb() {
  const users = new Map<string, UserRow>();
  const workspaces = new Map<string, WorkspaceRow>();
  const members: MemberRow[] = [];
  const conversations = new Map<string, ConversationRow>();
  const messages: MessageRow[] = [];

  const userView = (id: string) => {
    const u = users.get(id);
    return u ? { id: u.id, email: u.email } : null;
  };
  const memberView = (m: MemberRow) => ({ ...m, user: userView(m.userId)! });
  const membership = (workspaceId: string, userId: string) =>
    members.find((m) => m.workspaceId === workspaceId && m.userId === userId);
  const conversationView = (c: ConversationRow) => ({ ...c, createdBy: userView(c.createdById)! });
  const messageView = (m: MessageRow) => ({
    ...m,
    sender: m.senderId ? userView(m.senderId) : null,
  });

  const originals = new Map<object, Record<string, unknown>>();
  function patch<T extends object>(target: T, impl: Partial<Record<keyof T, unknown>>) {
    originals.set(target, { ...(target as Record<string, unknown>) });
    Object.assign(target, impl);
  }

  patch(authRepository, {
    async findUserById(id: string) {
      const u = users.get(id);
      return u ? { id: u.id, email: u.email, createdAt: u.createdAt } : null;
    },
  });

  patch(userRepository, {
    async findById(id: string) {
      return users.get(id) ?? null;
    },
    async searchUsers(input: { q: string; page: number; limit: number; workspaceId?: string }) {
      const all = [...users.values()]
        .filter((u) => u.email.toLowerCase().includes(input.q.toLowerCase()))
        .filter((u) => !input.workspaceId || !membership(input.workspaceId, u.id))
        .sort((a, b) => a.email.localeCompare(b.email));
      const data = all
        .slice((input.page - 1) * input.limit, input.page * input.limit)
        .map((u) => ({ id: u.id, email: u.email }));
      return {
        data,
        pagination: {
          page: input.page,
          limit: input.limit,
          total: all.length,
          totalPages: Math.ceil(all.length / input.limit),
        },
      };
    },
  });

  patch(workspaceRepository, {
    async create(userId: string, input: { name: string; description?: string | null; rootPath?: string | null }) {
      const ws: WorkspaceRow = {
        id: randomUUID(), name: input.name, description: input.description ?? null,
        rootPath: input.rootPath ?? null, createdById: userId, createdAt: now(), updatedAt: now(),
      };
      workspaces.set(ws.id, ws);
      members.push({ workspaceId: ws.id, userId, role: "OWNER", joinedAt: now() });
      return { ...ws };
    },
    async listForUser(userId: string) {
      return [...workspaces.values()]
        .filter((w) => membership(w.id, userId))
        .map((w) => ({
          ...w,
          role: membership(w.id, userId)!.role,
          memberCount: members.filter((m) => m.workspaceId === w.id).length,
          conversationCount: [...conversations.values()].filter((c) => c.workspaceId === w.id).length,
        }));
    },
    async findById(workspaceId: string) {
      const w = workspaces.get(workspaceId);
      if (!w) return null;
      return { ...w, members: members.filter((m) => m.workspaceId === workspaceId).map(memberView) };
    },
    async findMembership(workspaceId: string, userId: string) {
      const m = membership(workspaceId, userId);
      return m ? { ...m } : null;
    },
    async listMembers(workspaceId: string) {
      return members.filter((m) => m.workspaceId === workspaceId).map(memberView);
    },
    async update(workspaceId: string, input: Partial<WorkspaceRow>) {
      const w = workspaces.get(workspaceId);
      if (!w) throw prismaError("P2025");
      Object.assign(w, input, { updatedAt: now() });
      return { ...w };
    },
    async delete(workspaceId: string) {
      if (!workspaces.delete(workspaceId)) throw prismaError("P2025");
      for (let i = members.length - 1; i >= 0; i--) {
        if (members[i].workspaceId === workspaceId) members.splice(i, 1);
      }
      for (const [id, c] of conversations) {
        if (c.workspaceId === workspaceId) conversations.delete(id);
      }
      return { id: workspaceId };
    },
    async addMember(workspaceId: string, userId: string, role: Role) {
      if (membership(workspaceId, userId)) throw prismaError("P2002");
      const m: MemberRow = { workspaceId, userId, role, joinedAt: now() };
      members.push(m);
      return memberView(m);
    },
    async removeMember(workspaceId: string, userId: string) {
      const i = members.findIndex((m) => m.workspaceId === workspaceId && m.userId === userId);
      if (i < 0) throw prismaError("P2025");
      members.splice(i, 1);
      return { workspaceId, userId };
    },
    async updateMemberRole(workspaceId: string, userId: string, expected: Role, role: Role) {
      const m = membership(workspaceId, userId);
      if (!m || m.role !== expected) return null;
      m.role = role;
      return memberView(m);
    },
    async transferOwnership(workspaceId: string, currentOwnerId: string, newOwnerId: string) {
      const owner = membership(workspaceId, currentOwnerId);
      const target = membership(workspaceId, newOwnerId);
      if (!owner || owner.role !== "OWNER" || !target || target.role === "OWNER") return false;
      owner.role = "ADMIN";
      target.role = "OWNER";
      return true;
    },
    async findUserById(userId: string) {
      return userView(userId);
    },
  });

  patch(conversationRepository, {
    async listForWorkspace(workspaceId: string) {
      return [...conversations.values()]
        .filter((c) => c.workspaceId === workspaceId)
        .map(conversationView);
    },
    async listPersonal(userId: string) {
      return [...conversations.values()]
        .filter((c) => c.workspaceId === null && c.createdById === userId)
        .map(conversationView);
    },
    async findById(id: string) {
      const c = conversations.get(id);
      return c ? conversationView(c) : null;
    },
    async listMessages(conversationId: string) {
      return messages.filter((m) => m.conversationId === conversationId).map(messageView);
    },
    async create(input: { workspaceId: string | null; createdById: string; title: string | null }) {
      const c: ConversationRow = { id: randomUUID(), ...input, createdAt: now(), updatedAt: now() };
      conversations.set(c.id, c);
      return conversationView(c);
    },
    async updateTitle(id: string, title: string) {
      const c = conversations.get(id);
      if (!c) throw prismaError("P2025");
      c.title = title;
      return conversationView(c);
    },
    async delete(id: string) {
      if (!conversations.delete(id)) throw prismaError("P2025");
      return { id };
    },
    async findMessageByClientRequestId(conversationId: string, clientRequestId: string) {
      const m = messages.find(
        (x) => x.conversationId === conversationId && x.clientRequestId === clientRequestId,
      );
      return m ? messageView(m) : null;
    },
    async appendExchange(input: {
      conversationId: string; senderId: string; userContent: string; assistantContent: string;
      clientRequestId?: string; titleIfMissing: string;
    }) {
      const c = conversations.get(input.conversationId);
      if (!c) throw prismaError("P2025");
      const userMessage: MessageRow = {
        id: randomUUID(), conversationId: c.id, senderId: input.senderId, role: "USER",
        content: input.userContent, clientRequestId: input.clientRequestId ?? null, createdAt: now(),
      };
      const assistantMessage: MessageRow = {
        id: randomUUID(), conversationId: c.id, senderId: null, role: "ASSISTANT",
        content: input.assistantContent,
        clientRequestId: input.clientRequestId ? `${input.clientRequestId}:assistant` : null,
        createdAt: now(),
      };
      messages.push(userMessage, assistantMessage);
      c.title ??= input.titleIfMissing;
      c.updatedAt = now();
      return {
        userMessage: messageView(userMessage),
        assistantMessage: messageView(assistantMessage),
        conversation: conversationView(c),
      };
    },
  });

  return {
    addUser(email: string) {
      const u: UserRow = { id: randomUUID(), email, createdAt: now() };
      users.set(u.id, u);
      return u;
    },
    roleOf(workspaceId: string, userId: string) {
      return membership(workspaceId, userId)?.role ?? null;
    },
    restore() {
      for (const [target, impl] of originals) Object.assign(target, impl);
      originals.clear();
    },
  };
}
