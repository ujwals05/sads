import { LogOut, Plus, Search, Settings2, ShieldCheck } from 'lucide-react';
import type { AuthUser } from '../types/auth.ts';

interface ChatHeaderProps {
  onNewChat: () => void;
  user?: AuthUser | null;
  onLogout?: () => void;
}

export default function ChatHeader({
  onNewChat,
  user,
  onLogout,
}: ChatHeaderProps) {
  return (
    <header className="chat-header">
      <div className="brand">
        <div className="brand-icon">
          <ShieldCheck size={19} />
        </div>
        <div className="brand-copy">
          <strong>SADS</strong>
          <span title={user?.email ? `Signed in as ${user.email}` : undefined}>
            {user?.email ? user.email : 'AI coding assistant'}
          </span>
        </div>
      </div>

      <div className="header-actions">
        <button
          className="icon-button"
          title="Search conversations"
          aria-label="Search conversations"
          onClick={() =>
            window.dispatchEvent(new CustomEvent('sads:search'))
          }
        >
          <Search size={16} />
        </button>

        <button
          className="icon-button"
          title="Settings"
          aria-label="Settings"
          onClick={() =>
            window.dispatchEvent(new CustomEvent('sads:settings'))
          }
        >
          <Settings2 size={16} />
        </button>

        <button
          className="icon-button primary-icon"
          title="New chat"
          aria-label="New chat"
          onClick={onNewChat}
        >
          <Plus size={18} />
        </button>

        {user && onLogout && (
          <button
            className="icon-button logout-button"
            title={`Sign out (${user.email})`}
            aria-label={`Sign out (${user.email})`}
            onClick={onLogout}
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </header>
  );
}
