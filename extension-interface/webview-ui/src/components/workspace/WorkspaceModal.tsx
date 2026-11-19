import {
  Check,
  FolderGit2,
  FolderOpen,
  Info,
  Loader2,
  MessageSquare,
  Plus,
  Users,
  X,
} from 'lucide-react';
import { useEffect } from 'react';
import type {
  AssignableRole,
  Notice,
  UserSearchResult,
  Workspace,
  WorkspaceDetails,
  WorkspaceInput,
  WorkspaceModalTab,
} from '../../types/workspace.ts';
import { ROLE_LABELS } from '../../lib/permissions.ts';
import CreateWorkspaceForm from './CreateWorkspaceForm.tsx';
import WorkspaceMembers from './WorkspaceMembers.tsx';
import WorkspaceSettings from './WorkspaceSettings.tsx';
import NoticeBanner from './NoticeBanner.tsx';

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  tab: WorkspaceModalTab;
  onTabChange: (tab: WorkspaceModalTab) => void;
  workspaces: Workspace[];
  workspacesLoading: boolean;
  activeWorkspaceId: string | null;
  activeWorkspaceDetails: WorkspaceDetails | null;
  detailsLoading: boolean;
  currentUserId: string;
  loading: boolean;
  onSelectWorkspace: (workspaceId: string | null) => void;
  onCreateWorkspace: (data: WorkspaceInput) => void;
  onUpdateWorkspace: (data: Partial<WorkspaceInput>) => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  onLeaveWorkspace: () => void;
  onTransferOwnership: (userId: string, email: string) => void;
  onSearchUsers: (query: string) => void;
  searchResults: UserSearchResult[];
  searchLoading: boolean;
  searchedQuery: string;
  onAddMember: (user: UserSearchResult, role: AssignableRole) => void;
  onRemoveMember: (userId: string, email: string) => void;
  onUpdateMemberRole: (userId: string, email: string, role: AssignableRole) => void;
  detectedPath?: string;
  onRequestDetectPath: () => void;
  notice: Notice | null;
  onClearNotice: () => void;
}

export default function WorkspaceModal({
  isOpen,
  onClose,
  tab,
  onTabChange,
  workspaces,
  workspacesLoading,
  activeWorkspaceId,
  activeWorkspaceDetails,
  detailsLoading,
  currentUserId,
  loading,
  onSelectWorkspace,
  onCreateWorkspace,
  onUpdateWorkspace,
  onDeleteWorkspace,
  onLeaveWorkspace,
  onTransferOwnership,
  onSearchUsers,
  searchResults,
  searchLoading,
  searchedQuery,
  onAddMember,
  onRemoveMember,
  onUpdateMemberRole,
  detectedPath,
  onRequestDetectPath,
  notice,
  onClearNotice,
}: WorkspaceModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const details =
    activeWorkspaceDetails && activeWorkspaceDetails.id === activeWorkspaceId
      ? activeWorkspaceDetails
      : null;
  const needsDetails = tab === 'members' || tab === 'details';

  function switchTab(next: WorkspaceModalTab) {
    onClearNotice();
    onTabChange(next);
  }

  return (
    <div
      className="workspace-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workspace-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="workspace-modal-card">
        <div className="workspace-modal-header">
          <div className="modal-title-row">
            <FolderGit2 size={18} className="modal-header-icon" />
            <span className="modal-title" id="workspace-modal-title">
              {needsDetails && details ? details.name : 'Workspace Manager'}
            </span>
          </div>
          <button
            type="button"
            className="icon-button modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="workspace-modal-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'workspaces'}
            className={`ws-tab-btn ${tab === 'workspaces' ? 'active' : ''}`}
            onClick={() => switchTab('workspaces')}
          >
            <FolderOpen size={13} />
            <span>Workspaces</span>
          </button>

          {activeWorkspaceId && (
            <>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'details'}
                className={`ws-tab-btn ${tab === 'details' ? 'active' : ''}`}
                onClick={() => switchTab('details')}
              >
                <Info size={13} />
                <span>Details</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={tab === 'members'}
                className={`ws-tab-btn ${tab === 'members' ? 'active' : ''}`}
                onClick={() => switchTab('members')}
              >
                <Users size={13} />
                <span>Members{details ? ` (${details.members.length})` : ''}</span>
              </button>
            </>
          )}

          <button
            type="button"
            role="tab"
            aria-selected={tab === 'create'}
            className={`ws-tab-btn ${tab === 'create' ? 'active' : ''}`}
            onClick={() => switchTab('create')}
          >
            <Plus size={13} />
            <span>New</span>
          </button>
        </div>

        <div className="workspace-modal-body">
          {tab === 'workspaces' && (
            <div className="workspaces-list-view">
              <NoticeBanner notice={notice} onDismiss={onClearNotice} />

              <div className="workspaces-list-header">
                <h4>Your Workspaces ({workspaces.length})</h4>
                <button
                  type="button"
                  className="primary-action-btn"
                  onClick={() => switchTab('create')}
                >
                  <Plus size={13} />
                  <span>Create Workspace</span>
                </button>
              </div>

              {workspacesLoading && workspaces.length === 0 ? (
                <div className="loading-state-box">
                  <Loader2 size={18} className="spinner-icon" />
                  <span>Loading workspaces...</span>
                </div>
              ) : workspaces.length === 0 ? (
                <div className="empty-state-box">
                  <p>You are not a member of any workspace yet.</p>
                  <button
                    type="button"
                    className="primary-action-btn"
                    onClick={() => switchTab('create')}
                  >
                    Create your first workspace
                  </button>
                </div>
              ) : (
                <div className="workspaces-grid">
                  {workspaces.map((ws) => {
                    const isActive = ws.id === activeWorkspaceId;
                    return (
                      <div
                        key={ws.id}
                        className={`workspace-card-item ${isActive ? 'active' : ''}`}
                      >
                        <div className="ws-card-header">
                          <span className="ws-card-name">{ws.name}</span>
                          {ws.role && (
                            <span className={`ws-role-pill ws-role-${ws.role.toLowerCase()}`}>
                              {ROLE_LABELS[ws.role]}
                            </span>
                          )}
                          {isActive && <span className="active-badge">Active</span>}
                        </div>
                        {ws.description && (
                          <div className="ws-card-description">{ws.description}</div>
                        )}
                        {ws.rootPath && (
                          <div className="ws-card-path" title={ws.rootPath}>
                            {ws.rootPath}
                          </div>
                        )}
                        <div className="ws-card-footer">
                          <span className="ws-card-date">
                            <Users size={11} /> {ws.memberCount ?? '–'}
                            <MessageSquare size={11} /> {ws.conversationCount ?? '–'}
                            · Updated {new Date(ws.updatedAt).toLocaleDateString()}
                          </span>
                          {!isActive && (
                            <button
                              type="button"
                              className="secondary-btn compact-btn"
                              onClick={() => {
                                onSelectWorkspace(ws.id);
                                onClose();
                              }}
                            >
                              <Check size={12} />
                              <span>Select</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {needsDetails && !details && (
            <div className="loading-state-box">
              {detailsLoading ? (
                <>
                  <Loader2 size={18} className="spinner-icon" />
                  <span>Loading workspace...</span>
                </>
              ) : (
                <>
                  <NoticeBanner notice={notice} onDismiss={onClearNotice} />
                  <span>Select a workspace to see its details.</span>
                </>
              )}
            </div>
          )}

          {tab === 'members' && details && (
            <WorkspaceMembers
              workspace={details}
              currentUserId={currentUserId}
              loading={loading}
              onSearchUsers={onSearchUsers}
              searchResults={searchResults}
              searchLoading={searchLoading}
              searchedQuery={searchedQuery}
              onAddMember={onAddMember}
              onRemoveMember={onRemoveMember}
              onUpdateRole={onUpdateMemberRole}
              notice={notice}
              onClearNotice={onClearNotice}
            />
          )}

          {tab === 'details' && details && (
            <WorkspaceSettings
              // Remount on a refreshed workspace so the form re-syncs.
              key={`${details.id}:${details.updatedAt}`}
              workspace={details}
              currentUserId={currentUserId}
              loading={loading}
              onUpdate={onUpdateWorkspace}
              onDelete={() => onDeleteWorkspace(details.id)}
              onLeave={onLeaveWorkspace}
              onTransferOwnership={onTransferOwnership}
              notice={notice}
              onClearNotice={onClearNotice}
            />
          )}

          {tab === 'create' && (
            <>
              <NoticeBanner notice={notice} onDismiss={onClearNotice} />
              <CreateWorkspaceForm
                loading={loading}
                detectedPath={detectedPath}
                onRequestDetectPath={onRequestDetectPath}
                onSubmit={onCreateWorkspace}
                onCancel={() => switchTab('workspaces')}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
