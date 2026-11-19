import { useState, type FormEvent } from 'react';
import { FolderGit2, Loader2, Wand2 } from 'lucide-react';
import type { WorkspaceInput } from '../../types/workspace.ts';
import { validateWorkspaceFields } from '../../lib/validation.ts';

interface CreateWorkspaceFormProps {
  loading: boolean;
  detectedPath?: string;
  onRequestDetectPath: () => void;
  onSubmit: (data: WorkspaceInput) => void;
  onCancel?: () => void;
}

export default function CreateWorkspaceForm({
  loading,
  detectedPath,
  onRequestDetectPath,
  onSubmit,
  onCancel,
}: CreateWorkspaceFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [errors, setErrors] = useState<ReturnType<typeof validateWorkspaceFields>>({});

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    const errs = validateWorkspaceFields({ name, description, rootPath });
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      rootPath: rootPath.trim() || null,
    });
  }

  return (
    <form className="workspace-form" onSubmit={handleSubmit} noValidate>
      <div className="form-header-compact">
        <h3>Create Workspace</h3>
        <p>
          A shared space for a team: members, roles and chat sessions. You will
          become its owner.
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="ws-name" className="form-label">
          Workspace Name <span className="required-star">*</span>
        </label>
        <input
          id="ws-name"
          type="text"
          className={`auth-input ${errors.name ? 'has-error' : ''}`}
          placeholder="e.g. sads-core, web-app"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
          }}
          disabled={loading}
          autoFocus
          maxLength={100}
          aria-invalid={Boolean(errors.name)}
        />
        {errors.name && <div className="form-error">{errors.name}</div>}
      </div>

      <div className="form-group">
        <label htmlFor="ws-description" className="form-label">
          Description
        </label>
        <textarea
          id="ws-description"
          className={`auth-input auth-textarea ${errors.description ? 'has-error' : ''}`}
          placeholder="What is this workspace for? (optional)"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
          }}
          disabled={loading}
          maxLength={500}
          rows={3}
        />
        {errors.description && <div className="form-error">{errors.description}</div>}
      </div>

      <div className="form-group">
        <div className="form-label-row">
          <label htmlFor="ws-path" className="form-label">
            Project Folder
          </label>
          <button
            type="button"
            className="text-link-action"
            onClick={() => {
              onRequestDetectPath();
              if (detectedPath) setRootPath(detectedPath);
            }}
            title="Use the current VS Code folder"
          >
            <Wand2 size={12} />
            <span>Use current folder</span>
          </button>
        </div>
        <input
          id="ws-path"
          type="text"
          className={`auth-input ${errors.rootPath ? 'has-error' : ''}`}
          placeholder="Optional, e.g. /home/user/projects/sads"
          value={rootPath}
          onChange={(e) => {
            setRootPath(e.target.value);
            if (errors.rootPath) setErrors((prev) => ({ ...prev, rootPath: undefined }));
          }}
          disabled={loading}
          maxLength={1024}
        />
        {errors.rootPath && <div className="form-error">{errors.rootPath}</div>}
        <div className="form-hint">Optional local path associated with this workspace.</div>
      </div>

      <div className="form-actions-row">
        {onCancel && (
          <button
            type="button"
            className="secondary-btn"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
        )}
        <button type="submit" className="auth-submit-btn" disabled={loading}>
          {loading ? (
            <>
              <Loader2 size={14} className="spinner-icon" />
              <span>Creating...</span>
            </>
          ) : (
            <>
              <FolderGit2 size={14} />
              <span>Create Workspace</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
