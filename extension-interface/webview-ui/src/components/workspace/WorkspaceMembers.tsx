import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Crown, Loader2, LogOut, Search, Shield, Trash2, UserPlus } from 'lucide-react';
import type {
  AssignableRole,
  Notice,
  UserSearchResult,
  WorkspaceDetails,
  WorkspaceRole,
} from '../../types/workspace.ts';
import {
  ROLE_LABELS,
  assignableRolesFor,
  canChangeRoleOf,
  canManageMembers,
  canRemove,
} from '../../lib/permissions.ts';
import NoticeBanner from './NoticeBanner.tsx';

interface WorkspaceMembersProps {
  workspace: WorkspaceDetails;
  currentUserId: string;
  loading: boolean;
  onSearchUsers: (query: string) => void;
  searchResults: UserSearchResult[];
  searchLoading: boolean;
  searchedQuery: string;
  onAddMember: (user: UserSearchResult, role: AssignableRole) => void;
  onRemoveMember: (userId: string, email: string) => void;
  onUpdateRole: (userId: string, email: string, role: AssignableRole) => void;
  notice: Notice | null;
  onClearNotice: () => void;
}

const SEARCH_DEBOUNCE_MS = 300;

function roleBadgeClass(role: WorkspaceRole): string {
  return `role-badge role-badge-${role.toLowerCase()}`;
}

export default function WorkspaceMembers({
  workspace,
  currentUserId,
  loading,
  onSearchUsers,
  searchResults,
  searchLoading,
  searchedQuery,
  onAddMember,
  onRemoveMember,
  onUpdateRole,
  notice,
  onClearNotice,
}: WorkspaceMembersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<AssignableRole>('MEMBER');
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const myRole: WorkspaceRole =
    workspace.role ??
    workspace.members.find((m) => m.userId === currentUserId)?.role ??
    'MEMBER';
  const actor = { userId: currentUserId, role: myRole };
  const canManage = canManageMembers(myRole);
  const grantableRoles = workspace.permissions?.assignableRoles ?? assignableRolesFor(myRole);

  // Keep the latest callback without re-triggering the debounce effect.
  const searchRef = useRef(onSearchUsers);
  useEffect(() => {
    searchRef.current = onSearchUsers;
  }, [onSearchUsers]);

  // Search as the user types (debounced); the backend also excludes members.
  useEffect(() => {
    if (activeTab !== 'add') return;
    const q = searchQuery.trim();
    if (q.length < 2) return;
    const timer = setTimeout(() => searchRef.current(q), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  // Defence in depth: never show existing members even if results are stale.
  const memberIds = new Set(workspace.members.map((m) => m.userId));
  const availableUsers = searchResults.filter((u) => !memberIds.has(u.id));
  const showResultsFor = searchQuery.trim() && searchedQuery === searchQuery.trim();

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    onClearNotice();
    onSearchUsers(q);
  }

  return (
    <div className="workspace-members-view">
      <div className="members-subtabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'list'}
          className={`subtab-btn ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('list');
            onClearNotice();
          }}
        >
          <span>Members ({workspace.members.length})</span>
        </button>

        {canManage && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'add'}
            className={`subtab-btn ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('add');
              onClearNotice();
            }}
          >
            <UserPlus size={13} />
            <span>Add Member</span>
          </button>
        )}
      </div>

      <NoticeBanner notice={notice} onDismiss={onClearNotice} />

      {activeTab === 'list' && (
        <div className="members-list-container">
          {!canManage && (
            <p className="form-hint">
              Only the workspace owner and admins can manage members.
            </p>
          )}
          <div className="members-table">
            {workspace.members.map((member) => {
              const isSelf = member.userId === currentUserId;
              const email = member.user?.email || member.userId;
              const editable = canChangeRoleOf(actor, member);
              const removable = canRemove(actor, member);

              return (
                <div key={member.userId} className="member-row">
                  <div className="member-info">
                    <div className="member-email-row">
                      <span className="member-email" title={email}>
                        {email}
                      </span>
                      {isSelf && <span className="self-tag">You</span>}
                    </div>
                    <span className="member-joined">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="member-actions">
                    {confirmRemoveId === member.userId ? (
                      <>
                        <span className="confirm-inline">{isSelf ? 'Leave?' : 'Remove?'}</span>
                        <button
                          type="button"
                          className="danger-btn compact-btn"
                          disabled={loading}
                          onClick={() => {
                            setConfirmRemoveId(null);
                            onRemoveMember(member.userId, email);
                          }}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          className="secondary-btn compact-btn"
                          onClick={() => setConfirmRemoveId(null)}
                        >
                          No
                        </button>
                      </>
                    ) : (
                      <>
                        {editable ? (
                          <select
                            className="role-select"
                            value={member.role}
                            onChange={(e) =>
                              onUpdateRole(member.userId, email, e.target.value as AssignableRole)
                            }
                            disabled={loading}
                            aria-label={`Change role for ${email}`}
                          >
                            {grantableRoles.map((role) => (
                              <option key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={roleBadgeClass(member.role)}>
                            {member.role === 'OWNER' && <Crown size={11} />}
                            {member.role === 'ADMIN' && <Shield size={11} />}
                            {ROLE_LABELS[member.role]}
                          </span>
                        )}

                        {removable && (
                          <button
                            type="button"
                            className="icon-button danger-icon"
                            onClick={() => setConfirmRemoveId(member.userId)}
                            disabled={loading}
                            title={isSelf ? 'Leave workspace' : 'Remove member'}
                            aria-label={isSelf ? 'Leave workspace' : `Remove ${email}`}
                          >
                            {isSelf ? <LogOut size={13} /> : <Trash2 size={13} />}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'add' && canManage && (
        <div className="add-member-container">
          <form className="member-search-form" onSubmit={handleSearchSubmit} role="search">
            <div className="input-wrapper search-wrapper">
              <Search size={14} className="search-input-icon" />
              <input
                type="text"
                className="auth-input search-input"
                placeholder="Search registered users by email…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                maxLength={254}
                aria-label="Search users by email"
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

          <div className="add-role-selector">
            <span className="add-role-label">Assign role:</span>
            <div className="role-options">
              {grantableRoles.map((role) => (
                <label key={role} className="role-radio-label">
                  <input
                    type="radio"
                    name="add-role"
                    value={role}
                    checked={selectedRole === role}
                    onChange={() => setSelectedRole(role)}
                  />
                  <span>{ROLE_LABELS[role]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="search-results-list" aria-live="polite">
            {searchLoading ? (
              <div className="loading-state-box">
                <Loader2 size={18} className="spinner-icon" />
                <span>Searching registered users...</span>
              </div>
            ) : showResultsFor && availableUsers.length > 0 ? (
              <div className="search-results-table">
                {availableUsers.map((user) => (
                  <div key={user.id} className="search-result-row">
                    <div className="search-result-user">
                      <span className="user-email">{user.email}</span>
                    </div>
                    <button
                      type="button"
                      className="primary-action-btn"
                      onClick={() => onAddMember(user, selectedRole)}
                      disabled={loading}
                    >
                      <UserPlus size={13} />
                      <span>Add as {ROLE_LABELS[selectedRole]}</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : showResultsFor ? (
              <div className="empty-state-box">
                <span>
                  No registered users who aren't already members match "{searchQuery.trim()}".
                </span>
              </div>
            ) : (
              <div className="empty-state-box">
                <span>Type at least 2 characters of an email to search registered SADS users.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
