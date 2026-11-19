import { useState, useRef, useEffect } from 'react';
import {
  Check,
  ChevronDown,
  FolderGit2,
  Plus,
  Settings,
  User,
  Users,
} from 'lucide-react';
import type {
  Workspace,
  WorkspaceModalTab,
  WorkspaceRole,
} from '../../types/workspace.ts';
import { ROLE_LABELS } from '../../lib/permissions.ts';

interface WorkspaceSelectorProps {
  workspaces: Workspace[];
  /** null = personal chats. */
  activeWorkspaceId: string | null;
  activeRole?: WorkspaceRole | null;
  loading: boolean;
  error?: string | null;
  onSelectWorkspace: (workspaceId: string | null) => void;
  onOpenManager: (tab: WorkspaceModalTab) => void;
}

export default function WorkspaceSelector({
  workspaces,
  activeWorkspaceId,
  activeRole,
  loading,
  error,
  onSelectWorkspace,
  onOpenManager,
}: WorkspaceSelectorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setDropdownOpen(false);
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKey);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [dropdownOpen]);

  const label = activeWorkspace
    ? activeWorkspace.name
    : activeWorkspaceId && loading
      ? 'Loading workspace...'
      : 'Personal chats';

  return (
    <div className="workspace-selector-container" ref={containerRef}>
      <div className="workspace-selector-bar">
        <button
          type="button"
          className="workspace-selector-btn"
          onClick={() => setDropdownOpen((prev) => !prev)}
          title="Switch workspace"
          aria-expanded={dropdownOpen}
          aria-haspopup="listbox"
        >
          {activeWorkspace ? (
            <FolderGit2 size={15} className="ws-icon" />
          ) : (
            <User size={15} className="ws-icon" />
          )}
          <div className="ws-text-group">
            <span className="ws-name">{label}</span>
            {activeWorkspace && activeRole && (
              <span className={`ws-role-pill ws-role-${activeRole.toLowerCase()}`}>
                {ROLE_LABELS[activeRole]}
              </span>
            )}
          </div>
          <ChevronDown
            size={13}
            className={`ws-chevron ${dropdownOpen ? 'rotated' : ''}`}
          />
        </button>

        {activeWorkspace && (
          <div className="workspace-quick-actions">
            <button
              type="button"
              className="icon-button"
              onClick={() => onOpenManager('members')}
              title="Workspace members"
              aria-label="Workspace members"
            >
              <Users size={14} />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => onOpenManager('details')}
              title="Workspace details and settings"
              aria-label="Workspace details and settings"
            >
              <Settings size={14} />
            </button>
          </div>
        )}
      </div>

      {dropdownOpen && (
        <div className="workspace-dropdown-menu" role="listbox">
          <button
            type="button"
            className={`dropdown-item ${activeWorkspaceId === null ? 'selected' : ''}`}
            onClick={() => {
              onSelectWorkspace(null);
              setDropdownOpen(false);
            }}
            role="option"
            aria-selected={activeWorkspaceId === null}
          >
            <User size={13} />
            <span className="dropdown-item-name">Personal chats</span>
            {activeWorkspaceId === null && <Check size={13} className="check-icon" />}
          </button>

          <div className="dropdown-divider" />
          <div className="dropdown-section-title">Workspaces</div>

          <div className="dropdown-workspaces-list">
            {loading && workspaces.length === 0 ? (
              <div className="dropdown-empty">Loading workspaces...</div>
            ) : error && workspaces.length === 0 ? (
              <div className="dropdown-empty">{error}</div>
            ) : workspaces.length === 0 ? (
              <div className="dropdown-empty">No workspaces yet</div>
            ) : (
              workspaces.map((ws) => {
                const isSelected = ws.id === activeWorkspaceId;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    className={`dropdown-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onSelectWorkspace(ws.id);
                      setDropdownOpen(false);
                    }}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <FolderGit2 size={13} />
                    <span className="dropdown-item-name">{ws.name}</span>
                    {ws.role && (
                      <span className={`ws-role-pill ws-role-${ws.role.toLowerCase()}`}>
                        {ROLE_LABELS[ws.role]}
                      </span>
                    )}
                    {isSelected && <Check size={13} className="check-icon" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="dropdown-divider" />

          <button
            type="button"
            className="dropdown-action-btn"
            onClick={() => {
              setDropdownOpen(false);
              onOpenManager('workspaces');
            }}
          >
            <FolderGit2 size={14} />
            <span>Manage Workspaces</span>
          </button>
          <button
            type="button"
            className="dropdown-action-btn"
            onClick={() => {
              setDropdownOpen(false);
              onOpenManager('create');
            }}
          >
            <Plus size={14} />
            <span>Create New Workspace</span>
          </button>
        </div>
      )}
    </div>
  );
}
