import { useState } from 'react';
import {
  Check,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import type { Conversation } from '../types/conversation.ts';
import { conversationTitle } from '../lib/conversations.ts';

interface SessionListProps {
  heading: string;
  sessions: Conversation[];
  activeSessionId: string | null;
  loading: boolean;
  error: string | null;
  disabled?: boolean;
  canModify: (conversation: Conversation) => boolean;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onRetry: () => void;
}

export default function SessionList({
  heading,
  sessions,
  activeSessionId,
  loading,
  error,
  disabled = false,
  canModify,
  onSelect,
  onNewChat,
  onRename,
  onDelete,
  onRetry,
}: SessionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function commitRename(id: string) {
    const title = draftTitle.trim();
    if (title) onRename(id, title.slice(0, 120));
    setEditingId(null);
  }

  return (
    <section className="sessions">
      <div className="section-heading">
        <span>{heading}</span>
        <button
          className="text-icon-button"
          onClick={onNewChat}
          title="Start a new chat"
          aria-label="Start a new chat"
          disabled={disabled}
        >
          <Plus size={15} />
        </button>
      </div>

      {error && (
        <div className="session-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="text-icon-button"
            onClick={onRetry}
            title="Retry"
            aria-label="Retry loading chats"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      )}

      <div className="session-list">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          const editable = canModify(session);

          if (editingId === session.id) {
            return (
              <form
                key={session.id}
                className="session-item session-edit"
                onSubmit={(e) => {
                  e.preventDefault();
                  commitRename(session.id);
                }}
              >
                <input
                  className="session-title-input"
                  value={draftTitle}
                  maxLength={120}
                  autoFocus
                  aria-label="Conversation title"
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
                <button type="submit" className="session-action" title="Save" aria-label="Save title">
                  <Check size={13} />
                </button>
                <button
                  type="button"
                  className="session-action"
                  title="Cancel"
                  aria-label="Cancel rename"
                  onClick={() => setEditingId(null)}
                >
                  <X size={13} />
                </button>
              </form>
            );
          }

          if (confirmDeleteId === session.id) {
            return (
              <div key={session.id} className="session-item session-confirm" role="group">
                <span>Delete this chat?</span>
                <button
                  type="button"
                  className="session-action danger"
                  title="Delete"
                  aria-label="Confirm delete"
                  onClick={() => {
                    setConfirmDeleteId(null);
                    onDelete(session.id);
                  }}
                >
                  <Check size={13} />
                </button>
                <button
                  type="button"
                  className="session-action"
                  title="Keep"
                  aria-label="Cancel delete"
                  onClick={() => setConfirmDeleteId(null)}
                >
                  <X size={13} />
                </button>
              </div>
            );
          }

          return (
            <div
              key={session.id}
              className={`session-item ${isActive ? 'active' : ''}`}
            >
              <button
                type="button"
                className="session-select"
                onClick={() => onSelect(session.id)}
                disabled={disabled}
                title={conversationTitle(session)}
              >
                <MessageSquare size={15} />
                <span>{conversationTitle(session)}</span>
              </button>

              {editable && (
                <span className="session-actions">
                  <button
                    type="button"
                    className="session-action"
                    title="Rename"
                    aria-label="Rename chat"
                    onClick={() => {
                      setDraftTitle(session.title ?? '');
                      setEditingId(session.id);
                    }}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    className="session-action danger"
                    title="Delete"
                    aria-label="Delete chat"
                    onClick={() => setConfirmDeleteId(session.id)}
                    disabled={disabled}
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {loading && sessions.length === 0 && (
        <p className="empty-sessions">
          <Loader2 size={12} className="spinner-icon" /> Loading chats…
        </p>
      )}

      {!loading && !error && sessions.length === 0 && (
        <p className="empty-sessions">No conversations yet. Send a message to start one.</p>
      )}
    </section>
  );
}
