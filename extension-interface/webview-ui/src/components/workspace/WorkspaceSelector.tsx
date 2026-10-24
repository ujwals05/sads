import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  FolderGit2,
  Plus,
  Settings,
  Users,
  Check,
} from 'lucide-react';
import type { Workspace, WorkspaceRole } from '../../types/workspace.ts';

interface WorkspaceSelectorProps {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeRole?: WorkspaceRole;
  loading: boolean;
  onSelectWorkspace: (workspaceId: string) => void;
  onOpenManager: (tab: 'workspaces' | 'details' | 'members' | 'create') => void;
}

export default function WorkspaceSelector({
  workspaces,
  activeWorkspaceId,
  activeRole,
  loading,
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

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

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
          <FolderGit2 size={15} className="ws-icon" />
          <div className="ws-text-group">
            <span className="ws-name">
              {activeWorkspace
                ? activeWorkspace.name
                : loading
                ? 'Loading workspaces...'
                : 'No workspace selected'}
            </span>
            {activeRole && (
              <span className={`ws-role-pill ws-role-${activeRole.toLowerCase()}`}>
                {activeRole}
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
              title="Workspace Members"
              aria-label="Workspace Members"
            >
              <Users size={14} />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => onOpenManager('details')}
              title="Workspace Settings"
              aria-label="Workspace Settings"
            >
              <Settings size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div className="workspace-dropdown-menu" role="listbox">
          <div className="dropdown-section-title">Your Workspaces</div>

          <div className="dropdown-workspaces-list">
            {loading && workspaces.length === 0 ? (
              <div className="dropdown-empty">Loading workspaces...</div>
            ) : workspaces.length === 0 ? (
              <div className="dropdown-empty">No workspaces found</div>
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
