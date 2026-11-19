import { describe, expect, it } from 'vitest';
import {
  conversationTitle,
  isSameScope,
  toChatMessages,
  upsertConversation,
} from './conversations.ts';
import { validateWorkspaceFields } from './validation.ts';
import type { Conversation, ConversationMessage } from '../types/conversation.ts';

const conv = (id: string, updatedAt: string, title: string | null = null): Conversation => ({
  id,
  workspaceId: 'ws',
  createdById: 'u1',
  title,
  createdAt: updatedAt,
  updatedAt,
});

const msg = (over: Partial<ConversationMessage>): ConversationMessage => ({
  id: 'm',
  conversationId: 'c',
  senderId: 'u1',
  role: 'USER',
  content: 'hi',
  createdAt: '2026-11-01T00:00:00Z',
  ...over,
});

describe('conversation helpers', () => {
  it('falls back to a default title', () => {
    expect(conversationTitle({ title: null })).toBe('New conversation');
    expect(conversationTitle({ title: '  ' })).toBe('New conversation');
    expect(conversationTitle({ title: 'Plan' })).toBe('Plan');
  });

  it('maps persisted messages and labels other members', () => {
    const out = toChatMessages(
      [
        msg({ id: '1', senderId: 'u1' }),
        msg({ id: '2', role: 'ASSISTANT', senderId: null, content: 'reply' }),
        msg({ id: '3', senderId: 'u2', sender: { id: 'u2', email: 'bob@x.dev' } }),
        msg({ id: '4', role: 'SYSTEM' }),
      ],
      'u1',
    );
    expect(out).toEqual([
      { id: '1', role: 'user', text: 'hi', author: undefined },
      { id: '2', role: 'assistant', text: 'reply', author: undefined },
      { id: '3', role: 'user', text: 'hi', author: 'bob@x.dev' },
    ]);
  });

  it('upserts and keeps most-recent first', () => {
    const list = [conv('a', '2026-11-02T00:00:00Z'), conv('b', '2026-11-01T00:00:00Z')];
    const next = upsertConversation(list, conv('b', '2026-11-03T00:00:00Z', 'renamed'));
    expect(next.map((c) => c.id)).toEqual(['b', 'a']);
    expect(next[0].title).toBe('renamed');
    expect(next).toHaveLength(2);
  });

  it('compares scopes treating undefined as personal', () => {
    expect(isSameScope(null, undefined)).toBe(true);
    expect(isSameScope('ws', 'ws')).toBe(true);
    expect(isSameScope('ws', null)).toBe(false);
  });
});

describe('workspace form validation', () => {
  it('requires a name and bounds field lengths', () => {
    expect(validateWorkspaceFields({ name: ' ', description: '', rootPath: '' }).name).toBeTruthy();
    expect(validateWorkspaceFields({ name: 'ok', description: '', rootPath: '' })).toEqual({});
    expect(
      validateWorkspaceFields({ name: 'ok', description: 'x'.repeat(501), rootPath: '' }).description,
    ).toBeTruthy();
    expect(
      validateWorkspaceFields({ name: 'x'.repeat(101), description: '', rootPath: '' }).name,
    ).toBeTruthy();
  });
});
