export interface Conversation {
  id: string;
  workspaceId: string | null;
  createdById: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; email: string };
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: string;
  createdAt: string;
  sender?: { id: string; email: string } | null;
}

export interface ConversationDetails extends Conversation {
  messages: ConversationMessage[];
}

export interface MessageExchange {
  userMessage: ConversationMessage;
  assistantMessage: ConversationMessage | null;
  conversation: Conversation;
}
