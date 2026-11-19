import type { ChatMessage } from '../components/MessageList.tsx';
import type {
  Conversation,
  ConversationMessage,
} from '../types/conversation.ts';

export const UNTITLED_CONVERSATION = 'New conversation';

export function conversationTitle(conversation: Pick<Conversation, 'title'>): string {
  return conversation.title?.trim() || UNTITLED_CONVERSATION;
}

/** Map persisted messages to the chat UI model (system/tool rows are hidden). */
export function toChatMessages(
  messages: ConversationMessage[],
  currentUserId: string,
): ChatMessage[] {
  return messages
    .filter((m) => m.role === 'USER' || m.role === 'ASSISTANT')
    .map((m) => ({
      id: m.id,
      role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
      text: m.content,
      // Show who wrote a message in shared workspace chats.
      author:
        m.role === 'USER' && m.senderId && m.senderId !== currentUserId
          ? m.sender?.email
          : undefined,
    }));
}

/** Insert or replace a conversation and keep the list most-recent first. */
export function upsertConversation(
  list: Conversation[],
  conversation: Conversation,
): Conversation[] {
  const rest = list.filter((c) => c.id !== conversation.id);
  return [conversation, ...rest].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}

/** Same scope check the UI uses to discard responses for a stale workspace. */
export function isSameScope(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return (a ?? null) === (b ?? null);
}
