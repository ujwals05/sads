import { useState, type FormEvent } from 'react';
import { AlertTriangle, Loader2, Save, Trash2 } from 'lucide-react';
import type { WorkspaceDetails, WorkspaceRole } from '../../types/workspace.ts';

interface WorkspaceSettingsProps {
  workspace: WorkspaceDetails;
  currentUserId: string;
  loading: boolean;
  onUpdate: (data: { name?: string; rootPath?: string }) => void;
  onDelete: () => void;
  errorMessage: string | null;
  onClearError: () => void;
}

export default function WorkspaceSettings({
  workspace,
  currentUserId,
  loading,
  onUpdate,
  onDelete,
  errorMessage,
  onClearError,
}: WorkspaceSettingsProps) {
  const [name, setName] = useState(workspace.name);
  const [rootPath, setRootPath] = useState(workspace.rootPath);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  // Determine user's role
  const currentUserMember = workspace.members.find((m) => m.userId === currentUserId);
  const currentUserRole: WorkspaceRole = currentUserMember?.role || 'VIEWER';

  const isOwner = currentUserRole === 'OWNER';
  const canEdit = isOwner || currentUserRole === 'ADMIN';

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (loading || !canEdit) return;

    onClearError();
    onUpdate({
      name: name.trim() !== workspace.name ? name.trim() : undefined,
      rootPath: rootPath.trim() !== workspace.rootPath ? rootPath.trim() : undefined,
    });
  }

  const hasChanges =
    name.trim() !== workspace.name || rootPath.trim() !== workspace.rootPath;

  return (
    <div className="workspace-settings-view">
      {errorMessage && (
        <div className="auth-alert" role="alert">
          <AlertTriangle size={15} className="auth-alert-icon" />
          <div className="auth-alert-content">
            <span className="auth-alert-message">{errorMessage}</span>
          </div>
        </div>
      )}

      {/* General Settings */}
      <form onSubmit={handleSave} className="settings-form">
        <div className="settings-section">
          <h4>Workspace Information</h4>

          <div className="form-group">
            <label htmlFor="settings-name" className="form-label">
              Workspace Name
            </label>
            <input
              id="settings-name"
              type="text"
              className="auth-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading || !canEdit}
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label htmlFor="settings-path" className="form-label">
              Root Path
            </label>
            <input
              id="settings-path"
              type="text"
              className="auth-input"
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              disabled={loading || !canEdit}
              maxLength={1024}
            />
          </div>

          <div className="metadata-grid">
            <div className="meta-item">
              <span className="meta-label">Workspace ID:</span>
              <span className="meta-value" title={workspace.id}>
                {workspace.id}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Created At:</span>
              <span className="meta-value">
                {new Date(workspace.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Your Role:</span>
              <span className="meta-value role-highlight">
                {currentUserRole}
              </span>
            </div>
          </div>

          {canEdit && (
            <div className="settings-actions">
              <button
                type="submit"
                className="auth-submit-btn compact-btn"
                disabled={loading || !hasChanges}
              >
                {loading ? (
                  <>
                    <Loader2 size={13} className="spinner-icon" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </form>

      {/* Danger Zone: Delete Workspace (OWNER only) */}
      {isOwner && (
        <div className="danger-zone-section">
          <h4>Danger Zone</h4>
          <p className="danger-zone-desc">
            Deleting this workspace permanently removes all associated project members,
            conversations, tasks, and dependency analysis history.
          </p>

          {!confirmDelete ? (
            <button
              type="button"
              className="danger-btn"
              onClick={() => setConfirmDelete(true)}
              disabled={loading}
            >
              <Trash2 size={14} />
              <span>Delete this Workspace</span>
            </button>
          ) : (
            <div className="confirm-delete-box">
              <p className="confirm-prompt">
                To confirm deletion, type <strong>{workspace.name}</strong> below:
              </p>
              <input
                type="text"
                className="auth-input has-error"
                placeholder={workspace.name}
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                autoFocus
              />
              <div className="confirm-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setConfirmDelete(false);
                    setDeleteConfirmationText('');
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="danger-btn"
                  disabled={loading || deleteConfirmationText !== workspace.name}
                  onClick={onDelete}
                >
                  {loading ? (
                    <Loader2 size={13} className="spinner-icon" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                  <span>Permanently Delete</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
