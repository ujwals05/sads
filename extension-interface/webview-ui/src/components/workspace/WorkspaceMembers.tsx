import { useState } from 'react';
import {
  AlertCircle,
  Crown,
  Loader2,
  Search,
  Shield,
  Trash2,
  UserPlus,
} from 'lucide-react';
import type {
  UserSearchResult,
  WorkspaceDetails,
  WorkspaceRole,
} from '../../types/workspace.ts';

interface WorkspaceMembersProps {
  workspace: WorkspaceDetails;
  currentUserId: string;
  loading: boolean;
  onSearchUsers: (query: string) => void;
  searchResults: UserSearchResult[];
  searchLoading: boolean;
  onAddMember: (userId: string, role: 'ADMIN' | 'DEVELOPER' | 'VIEWER') => void;
  onRemoveMember: (userId: string) => void;
  onUpdateRole: (userId: string, role: 'ADMIN' | 'DEVELOPER' | 'VIEWER') => void;
  errorMessage: string | null;
  onClearError: () => void;
}

export default function WorkspaceMembers({
  workspace,
  currentUserId,
  loading,
  onSearchUsers,
  searchResults,
  searchLoading,
  onAddMember,
  onRemoveMember,
  onUpdateRole,
  errorMessage,
  onClearError,
}: WorkspaceMembersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'DEVELOPER' | 'VIEWER'>('DEVELOPER');
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');

  // Determine current user's role in this workspace
  const currentUserMember = workspace.members.find((m) => m.userId === currentUserId);
  const currentUserRole: WorkspaceRole = currentUserMember?.role || 'VIEWER';

  const isOwner = currentUserRole === 'OWNER';
  const isAdmin = currentUserRole === 'ADMIN';
  const canManage = isOwner || isAdmin;

  // Filter out any users in searchResults that are already members
  const memberUserIds = new Set(workspace.members.map((m) => m.userId));
  const availableUsers = searchResults.filter((u) => !memberUserIds.has(u.id));

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    onClearError();
    onSearchUsers(searchQuery.trim());
  }

  function getRoleBadgeClass(role: WorkspaceRole): string {
    switch (role) {
      case 'OWNER':
        return 'role-badge-owner';
      case 'ADMIN':
        return 'role-badge-admin';
      case 'DEVELOPER':
        return 'role-badge-dev';
      case 'VIEWER':
        return 'role-badge-viewer';
    }
  }

  return (
    <div className="workspace-members-view">
      {/* Subtabs: Current Members vs Add Member */}
      <div className="members-subtabs">
        <button
          type="button"
          className={`subtab-btn ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('list');
            onClearError();
          }}
        >
          <span>Members ({workspace.members.length})</span>
        </button>

        {canManage && (
          <button
            type="button"
            className={`subtab-btn ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('add');
              onClearError();
            }}
          >
            <UserPlus size={13} />
            <span>Add Member</span>
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="auth-alert" role="alert">
          <AlertCircle size={15} className="auth-alert-icon" />
          <div className="auth-alert-content">
            <span className="auth-alert-message">{errorMessage}</span>
          </div>
        </div>
      )}

      {/* 1. Member List Tab */}
      {activeTab === 'list' && (
        <div className="members-list-container">
          <div className="members-table">
            {workspace.members.map((member) => {
              const isSelf = member.userId === currentUserId;
              const isMemberOwner = member.role === 'OWNER';
              const isMemberAdmin = member.role === 'ADMIN';

              // Determine whether current user can remove this member
              const canRemove =
                (!isMemberOwner && isOwner) ||
                (isAdmin && !isMemberOwner && !isMemberAdmin) ||
                (isSelf && !isMemberOwner);

              // Determine whether current user can change this member's role
              const canEditRole =
                !isMemberOwner &&
                (isOwner || (isAdmin && !isMemberAdmin));

              return (
                <div key={member.userId} className="member-row">
                  <div className="member-info">
                    <div className="member-email-row">
                      <span className="member-email" title={member.user?.email || member.userId}>
                        {member.user?.email || member.userId}
                      </span>
                      {isSelf && <span className="self-tag">You</span>}
                    </div>
                    <span className="member-joined">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="member-actions">
                    {canEditRole ? (
                      <select
                        className="role-select"
                        value={member.role}
                        onChange={(e) =>
                          onUpdateRole(
                            member.userId,
                            e.target.value as 'ADMIN' | 'DEVELOPER' | 'VIEWER',
                          )
                        }
                        disabled={loading}
                        aria-label={`Change role for ${member.user?.email || member.userId}`}
                      >
                        {isOwner && <option value="ADMIN">ADMIN</option>}
                        <option value="DEVELOPER">DEVELOPER</option>
                        <option value="VIEWER">VIEWER</option>
                      </select>
                    ) : (
                      <span className={`role-badge ${getRoleBadgeClass(member.role)}`}>
                        {member.role === 'OWNER' && <Crown size={11} />}
                        {member.role === 'ADMIN' && <Shield size={11} />}
                        {member.role}
                      </span>
                    )}

                    {canRemove && (
                      <button
                        type="button"
                        className="icon-button danger-icon"
                        onClick={() => onRemoveMember(member.userId)}
                        disabled={loading}
                        title={isSelf ? 'Leave workspace' : 'Remove member'}
                        aria-label={isSelf ? 'Leave workspace' : 'Remove member'}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Add Member Tab */}
      {activeTab === 'add' && canManage && (
        <div className="add-member-container">
          <form className="member-search-form" onSubmit={handleSearchSubmit}>
            <div className="input-wrapper search-wrapper">
              <Search size={14} className="search-input-icon" />
              <input
                type="text"
                className="auth-input search-input"
                placeholder="Search registered user email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={searchLoading}
                autoFocus
              />
              <button
                type="submit"
                className="search-btn"
                disabled={searchLoading || !searchQuery.trim()}
              >
                {searchLoading ? <Loader2 size={13} className="spinner-icon" /> : 'Search'}
              </button>
            </div>
          </form>

          {/* Role selector for the user to be added */}
          <div className="add-role-selector">
            <span className="add-role-label">Assign Role:</span>
            <div className="role-options">
              {isOwner && (
                <label className="role-radio-label">
                  <input
                    type="radio"
                    name="add-role"
                    value="ADMIN"
                    checked={selectedRole === 'ADMIN'}
                    onChange={() => setSelectedRole('ADMIN')}
                  />
                  <span>ADMIN</span>
                </label>
              )}
              <label className="role-radio-label">
                <input
                  type="radio"
                  name="add-role"
                  value="DEVELOPER"
                  checked={selectedRole === 'DEVELOPER'}
                  onChange={() => setSelectedRole('DEVELOPER')}
                />
                <span>DEVELOPER</span>
              </label>
              <label className="role-radio-label">
                <input
                  type="radio"
                  name="add-role"
                  value="VIEWER"
                  checked={selectedRole === 'VIEWER'}
                  onChange={() => setSelectedRole('VIEWER')}
                />
                <span>VIEWER</span>
              </label>
            </div>
          </div>

          {/* Search Results */}
          <div className="search-results-list">
            {searchLoading ? (
              <div className="loading-state-box">
                <Loader2 size={18} className="spinner-icon" />
                <span>Searching registered users...</span>
              </div>
            ) : availableUsers.length > 0 ? (
              <div className="search-results-table">
                {availableUsers.map((user) => (
                  <div key={user.id} className="search-result-row">
                    <div className="search-result-user">
                      <span className="user-email">{user.email}</span>
                    </div>
                    <button
                      type="button"
                      className="primary-action-btn"
                      onClick={() => onAddMember(user.id, selectedRole)}
                      disabled={loading}
                    >
                      <UserPlus size={13} />
                      <span>Add as {selectedRole}</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : searchQuery.trim() ? (
              <div className="empty-state-box">
                <span>No eligible registered users found matching "{searchQuery}".</span>
              </div>
            ) : (
              <div className="empty-state-box">
                <span>Type an email above to search registered SADS users.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
