export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER';

/** Roles that can be granted via add-member / change-role (never OWNER). */
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

export interface WorkspacePermissions {
  canUpdate: boolean;
  canDelete: boolean;
  assignableRoles: AssignableRole[];
}

export interface WorkspaceDetails extends Workspace {
  members: WorkspaceMember[];
  permissions?: WorkspacePermissions;
}

export interface WorkspaceInput {
  name: string;
  description: string | null;
  rootPath: string | null;
}

export interface UserSearchResult {
  id: string;
  email: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type WorkspaceModalTab = 'workspaces' | 'details' | 'members' | 'create';

export interface Notice {
  kind: 'success' | 'error';
  text: string;
}
