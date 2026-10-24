import { useState, type FormEvent } from 'react';
import { FolderGit2, Loader2, Wand2 } from 'lucide-react';

interface CreateWorkspaceFormProps {
  loading: boolean;
  detectedPath?: string;
  onRequestDetectPath: () => void;
  onSubmit: (data: { name: string; rootPath: string }) => void;
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
  const [rootPath, setRootPath] = useState(detectedPath || '');
  const [errors, setErrors] = useState<{ name?: string; rootPath?: string }>({});

  // If detectedPath updates and rootPath is empty, set it
  if (detectedPath && !rootPath) {
    setRootPath(detectedPath);
  }

  function validate(): boolean {
    const errs: { name?: string; rootPath?: string } = {};
    const trimmedName = name.trim();
    const trimmedPath = rootPath.trim();

    if (!trimmedName) {
      errs.name = 'Workspace name is required.';
    } else if (trimmedName.length > 100) {
      errs.name = 'Workspace name must not exceed 100 characters.';
    }

    if (!trimmedPath) {
      errs.rootPath = 'Project root path is required.';
    } else if (trimmedPath.length > 1024) {
      errs.rootPath = 'Project root path is too long.';
    } else if (trimmedPath.includes('\0')) {
      errs.rootPath = 'Path contains invalid characters.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    if (validate()) {
      onSubmit({
        name: name.trim(),
        rootPath: rootPath.trim(),
      });
    }
  }

  return (
    <form className="workspace-form" onSubmit={handleSubmit} noValidate>
      <div className="form-header-compact">
        <h3>Create Workspace</h3>
        <p>Set up a software project workspace with team access and dependency policies.</p>
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
        />
        {errors.name && <div className="form-error">{errors.name}</div>}
      </div>

      <div className="form-group">
        <div className="form-label-row">
          <label htmlFor="ws-path" className="form-label">
            Root Path <span className="required-star">*</span>
          </label>
          <button
            type="button"
            className="text-link-action"
            onClick={() => {
              onRequestDetectPath();
              if (detectedPath) setRootPath(detectedPath);
            }}
            title="Detect from current VS Code folder"
          >
            <Wand2 size={12} />
            <span>Detect folder</span>
          </button>
        </div>
        <input
          id="ws-path"
          type="text"
          className={`auth-input ${errors.rootPath ? 'has-error' : ''}`}
          placeholder="e.g. /home/user/projects/sads or D:\projects\sads"
          value={rootPath}
          onChange={(e) => {
            setRootPath(e.target.value);
            if (errors.rootPath) setErrors((prev) => ({ ...prev, rootPath: undefined }));
          }}
          disabled={loading}
          maxLength={1024}
        />
        {errors.rootPath && <div className="form-error">{errors.rootPath}</div>}
        <div className="form-hint">
          Absolute directory path for this workspace on your system.
        </div>
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
        <button
          type="submit"
          className="auth-submit-btn"
          disabled={loading}
        >
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
