export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'VIEWER';

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
  rootPath: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceDetails extends Workspace {
  members: WorkspaceMember[];
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
