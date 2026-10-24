import {
  FolderGit2,
  Plus,
  Settings,
  Users,
  X,
  Check,
  FolderOpen,
} from 'lucide-react';
import type {
  UserSearchResult,
  Workspace,
  WorkspaceDetails,
} from '../../types/workspace.ts';
import CreateWorkspaceForm from './CreateWorkspaceForm.tsx';
import WorkspaceMembers from './WorkspaceMembers.tsx';
import WorkspaceSettings from './WorkspaceSettings.tsx';

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  tab: 'workspaces' | 'details' | 'members' | 'create';
  onTabChange: (tab: 'workspaces' | 'details' | 'members' | 'create') => void;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeWorkspaceDetails: WorkspaceDetails | null;
  currentUserId: string;
  loading: boolean;
  onSelectWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: (data: { name: string; rootPath: string }) => void;
  onUpdateWorkspace: (data: { name?: string; rootPath?: string }) => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  onSearchUsers: (query: string) => void;
  searchResults: UserSearchResult[];
  searchLoading: boolean;
  onAddMember: (userId: string, role: 'ADMIN' | 'DEVELOPER' | 'VIEWER') => void;
  onRemoveMember: (userId: string) => void;
  onUpdateMemberRole: (
    userId: string,
    role: 'ADMIN' | 'DEVELOPER' | 'VIEWER',
  ) => void;
  detectedPath?: string;
  onRequestDetectPath: () => void;
  errorMessage: string | null;
  onClearError: () => void;
}

export default function WorkspaceModal({
  isOpen,
  onClose,
  tab,
  onTabChange,
  workspaces,
  activeWorkspaceId,
  activeWorkspaceDetails,
  currentUserId,
  loading,
  onSelectWorkspace,
  onCreateWorkspace,
  onUpdateWorkspace,
  onDeleteWorkspace,
  onSearchUsers,
  searchResults,
  searchLoading,
  onAddMember,
  onRemoveMember,
  onUpdateMemberRole,
  detectedPath,
  onRequestDetectPath,
  errorMessage,
  onClearError,
}: WorkspaceModalProps) {
  if (!isOpen) return null;

  return (
    <div className="workspace-modal-overlay" role="dialog" aria-modal="true">
      <div className="workspace-modal-card">
        {/* Modal Header */}
        <div className="workspace-modal-header">
          <div className="modal-title-row">
            <FolderGit2 size={18} className="modal-header-icon" />
            <span className="modal-title">
              {activeWorkspaceDetails
                ? activeWorkspaceDetails.name
                : 'Workspace Manager'}
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

        {/* Modal Tabs */}
        <div className="workspace-modal-tabs" role="tablist">
          <button
            type="button"
            className={`ws-tab-btn ${tab === 'workspaces' ? 'active' : ''}`}
            onClick={() => {
              onClearError();
              onTabChange('workspaces');
            }}
          >
            <FolderOpen size={13} />
            <span>Workspaces</span>
          </button>

          {activeWorkspaceDetails && (
            <>
              <button
                type="button"
                className={`ws-tab-btn ${tab === 'members' ? 'active' : ''}`}
                onClick={() => {
                  onClearError();
                  onTabChange('members');
                }}
              >
                <Users size={13} />
                <span>Members ({activeWorkspaceDetails.members.length})</span>
              </button>

              <button
                type="button"
                className={`ws-tab-btn ${tab === 'details' ? 'active' : ''}`}
                onClick={() => {
                  onClearError();
                  onTabChange('details');
                }}
              >
                <Settings size={13} />
                <span>Settings</span>
              </button>
            </>
          )}

          <button
            type="button"
            className={`ws-tab-btn ${tab === 'create' ? 'active' : ''}`}
            onClick={() => {
              onClearError();
              onTabChange('create');
            }}
          >
            <Plus size={13} />
            <span>New</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="workspace-modal-body">
          {tab === 'workspaces' && (
            <div className="workspaces-list-view">
              <div className="workspaces-list-header">
                <h4>Your Projects ({workspaces.length})</h4>
                <button
                  type="button"
                  className="primary-action-btn"
                  onClick={() => onTabChange('create')}
                >
                  <Plus size={13} />
                  <span>Create Workspace</span>
                </button>
              </div>

              {workspaces.length === 0 ? (
                <div className="empty-state-box">
                  <p>You do not have any workspaces yet.</p>
                  <button
                    type="button"
                    className="primary-action-btn"
                    onClick={() => onTabChange('create')}
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
                        className={`workspace-card-item ${
                          isActive ? 'active' : ''
                        }`}
                      >
                        <div className="ws-card-header">
                          <span className="ws-card-name">{ws.name}</span>
                          {isActive && (
                            <span className="active-badge">Active</span>
                          )}
                        </div>
                        <div className="ws-card-path" title={ws.rootPath}>
                          {ws.rootPath}
                        </div>
                        <div className="ws-card-footer">
                          <span className="ws-card-date">
                            Updated {new Date(ws.updatedAt).toLocaleDateString()}
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

          {tab === 'members' && activeWorkspaceDetails && (
            <WorkspaceMembers
              workspace={activeWorkspaceDetails}
              currentUserId={currentUserId}
              loading={loading}
              onSearchUsers={onSearchUsers}
              searchResults={searchResults}
              searchLoading={searchLoading}
              onAddMember={onAddMember}
              onRemoveMember={onRemoveMember}
              onUpdateRole={onUpdateMemberRole}
              errorMessage={errorMessage}
              onClearError={onClearError}
            />
          )}

          {tab === 'details' && activeWorkspaceDetails && (
            <WorkspaceSettings
              workspace={activeWorkspaceDetails}
              currentUserId={currentUserId}
              loading={loading}
              onUpdate={onUpdateWorkspace}
              onDelete={() => onDeleteWorkspace(activeWorkspaceDetails.id)}
              errorMessage={errorMessage}
              onClearError={onClearError}
            />
          )}

          {tab === 'create' && (
            <CreateWorkspaceForm
              loading={loading}
              detectedPath={detectedPath}
              onRequestDetectPath={onRequestDetectPath}
              onSubmit={onCreateWorkspace}
              onCancel={() => onTabChange('workspaces')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
