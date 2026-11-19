export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER';

/** Roles that can be granted via add-member / change-role. */
export type AssignableRole = 'ADMIN' | 'MEMBER';

export interface WorkspaceMemberUser {
  id: string;
  email: string;
}

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
  user?: WorkspaceMemberUser;
}

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  rootPath: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  role?: WorkspaceRole | null;
  memberCount?: number;
  conversationCount?: number;
}

export interface WorkspaceDetails extends Workspace {
  members: WorkspaceMember[];
  permissions?: {
    canUpdate: boolean;
    canDelete: boolean;
    assignableRoles: AssignableRole[];
  };
}

export interface UserSearchResult {
  id: string;
  email: string;
}

export interface UserSearchResponse {
  data: UserSearchResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Conversation {
  id: string;
  workspaceId: string | null;
  createdById: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: WorkspaceMemberUser;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: string;
  createdAt: string;
  sender?: WorkspaceMemberUser | null;
}

export interface ConversationDetails extends Conversation {
  messages: ConversationMessage[];
}

export interface MessageExchange {
  userMessage: ConversationMessage;
  assistantMessage: ConversationMessage | null;
  conversation: Conversation;
}
