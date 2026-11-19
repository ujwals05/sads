import { useState, type FormEvent } from 'react';
import { Crown, Loader2, LogOut, Save, Trash2 } from 'lucide-react';
import type {
  Notice,
  WorkspaceDetails,
  WorkspaceInput,
  WorkspaceRole,
} from '../../types/workspace.ts';
import { ROLE_LABELS, canUpdateWorkspace } from '../../lib/permissions.ts';
import { validateWorkspaceFields } from '../../lib/validation.ts';
import NoticeBanner from './NoticeBanner.tsx';

interface WorkspaceSettingsProps {
  workspace: WorkspaceDetails;
  currentUserId: string;
  loading: boolean;
  onUpdate: (data: Partial<WorkspaceInput>) => void;
  onDelete: () => void;
  onLeave: () => void;
  onTransferOwnership: (userId: string, email: string) => void;
  notice: Notice | null;
  onClearNotice: () => void;
}

/** Workspace details page: overview, editable settings, ownership and danger zone. */
export default function WorkspaceSettings({
  workspace,
  currentUserId,
  loading,
  onUpdate,
  onDelete,
  onLeave,
  onTransferOwnership,
  notice,
  onClearNotice,
}: WorkspaceSettingsProps) {
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description ?? '');
  const [rootPath, setRootPath] = useState(workspace.rootPath ?? '');
  const [errors, setErrors] = useState<ReturnType<typeof validateWorkspaceFields>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [transferTarget, setTransferTarget] = useState('');
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const myRole: WorkspaceRole =
    workspace.role ??
    workspace.members.find((m) => m.userId === currentUserId)?.role ??
    'MEMBER';
  const isOwner = myRole === 'OWNER';
  const canEdit = workspace.permissions?.canUpdate ?? canUpdateWorkspace(myRole);
  const canDelete = workspace.permissions?.canDelete ?? isOwner;

  const changes: Partial<WorkspaceInput> = {};
  if (name.trim() !== workspace.name) changes.name = name.trim();
  if ((description.trim() || null) !== (workspace.description ?? null)) {
    changes.description = description.trim() || null;
  }
  if ((rootPath.trim() || null) !== (workspace.rootPath ?? null)) {
    changes.rootPath = rootPath.trim() || null;
  }
  const hasChanges = Object.keys(changes).length > 0;

  const transferCandidates = workspace.members.filter((m) => m.userId !== currentUserId);
  const transferEmail =
    transferCandidates.find((m) => m.userId === transferTarget)?.user?.email ?? transferTarget;

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (loading || !canEdit || !hasChanges) return;
    const errs = validateWorkspaceFields({ name, description, rootPath });
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onClearNotice();
    onUpdate(changes);
  }

  return (
    <div className="workspace-settings-view">
      <NoticeBanner notice={notice} onDismiss={onClearNotice} />

      <div className="metadata-grid">
        <div className="meta-item">
          <span className="meta-label">Your role</span>
          <span className={`role-badge role-badge-${myRole.toLowerCase()}`}>
            {myRole === 'OWNER' && <Crown size={11} />}
            {ROLE_LABELS[myRole]}
          </span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Members</span>
          <span className="meta-value">{workspace.members.length}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Owner</span>
          <span className="meta-value">
            {workspace.members.find((m) => m.role === 'OWNER')?.user?.email ?? '—'}
          </span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Created</span>
          <span className="meta-value">{new Date(workspace.createdAt).toLocaleString()}</span>
        </div>
      </div>

      <form onSubmit={handleSave} className="settings-form">
        <div className="settings-section">
          <h4>Workspace Information</h4>
          {!canEdit && (
            <p className="form-hint">Only the owner and admins can edit workspace settings.</p>
          )}

          <div className="form-group">
            <label htmlFor="settings-name" className="form-label">
              Workspace Name
            </label>
            <input
              id="settings-name"
              type="text"
              className={`auth-input ${errors.name ? 'has-error' : ''}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading || !canEdit}
              maxLength={100}
            />
            {errors.name && <div className="form-error">{errors.name}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="settings-description" className="form-label">
              Description
            </label>
            <textarea
              id="settings-description"
              className={`auth-input auth-textarea ${errors.description ? 'has-error' : ''}`}
              value={description}
              placeholder={canEdit ? 'Add a description' : 'No description'}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading || !canEdit}
              maxLength={500}
              rows={3}
            />
            {errors.description && <div className="form-error">{errors.description}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="settings-path" className="form-label">
              Project Folder
            </label>
            <input
              id="settings-path"
              type="text"
              className={`auth-input ${errors.rootPath ? 'has-error' : ''}`}
              value={rootPath}
              placeholder="Not set"
              onChange={(e) => setRootPath(e.target.value)}
              disabled={loading || !canEdit}
              maxLength={1024}
            />
            {errors.rootPath && <div className="form-error">{errors.rootPath}</div>}
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

      {isOwner && (
        <div className="danger-zone-section">
          <h4>Transfer Ownership</h4>
          <p className="danger-zone-desc">
            The new owner gets full control. You will become an admin.
          </p>
          {transferCandidates.length === 0 ? (
            <p className="form-hint">Add another member before transferring ownership.</p>
          ) : !confirmTransfer ? (
            <div className="inline-form-row">
              <select
                className="role-select grow"
                value={transferTarget}
                onChange={(e) => setTransferTarget(e.target.value)}
                disabled={loading}
                aria-label="New owner"
              >
                <option value="">Select a member…</option>
                {transferCandidates.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user?.email ?? m.userId} ({ROLE_LABELS[m.role]})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="secondary-btn compact-btn"
                disabled={loading || !transferTarget}
                onClick={() => setConfirmTransfer(true)}
              >
                <Crown size={12} />
                <span>Transfer</span>
              </button>
            </div>
          ) : (
            <div className="confirm-delete-box">
              <p className="confirm-prompt">
                Make <strong>{transferEmail}</strong> the owner of {workspace.name}?
              </p>
              <div className="confirm-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setConfirmTransfer(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="danger-btn"
                  disabled={loading}
                  onClick={() => {
                    onClearNotice();
                    onTransferOwnership(transferTarget, transferEmail);
                  }}
                >
                  <Crown size={13} />
                  <span>Transfer Ownership</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!isOwner && (
        <div className="danger-zone-section">
          <h4>Leave Workspace</h4>
          <p className="danger-zone-desc">
            You will lose access to this workspace and its conversations.
          </p>
          {!confirmLeave ? (
            <button
              type="button"
              className="danger-btn"
              onClick={() => setConfirmLeave(true)}
              disabled={loading}
            >
              <LogOut size={14} />
              <span>Leave Workspace</span>
            </button>
          ) : (
            <div className="confirm-actions left">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setConfirmLeave(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button type="button" className="danger-btn" onClick={onLeave} disabled={loading}>
                <LogOut size={13} />
                <span>Confirm Leave</span>
              </button>
            </div>
          )}
        </div>
      )}

      {canDelete && (
        <div className="danger-zone-section">
          <h4>Danger Zone</h4>
          <p className="danger-zone-desc">
            Deleting this workspace permanently removes its members, conversations,
            tasks, and dependency analysis history.
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
                aria-label="Type the workspace name to confirm"
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
                  {loading ? <Loader2 size={13} className="spinner-icon" /> : <Trash2 size={13} />}
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
