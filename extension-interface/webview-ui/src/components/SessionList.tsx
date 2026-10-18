
import { MessageSquare, Plus } from 'lucide-react';

export interface ChatSession {
  id: string;
  title: string;
}

interface SessionListProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}

export default function SessionList({
  sessions,
  activeSessionId,
  onSelect,
  onNewChat,
}: SessionListProps) {
  return (
    <section className="sessions">
      <div className="section-heading">
        <span>YOUR CHATS</span>
        <button
          className="text-icon-button"
          onClick={onNewChat}
          title="Start a new chat"
        >
          <Plus size={15} />
        </button>
      </div>

      <div className="session-list">
        {sessions.map((session) => (
          <button
            key={session.id}
            className={`session-item ${
              session.id === activeSessionId ? 'active' : ''
            }`}
            onClick={() => onSelect(session.id)}
          >
            <MessageSquare size={15} />
            <span>{session.title}</span>
          </button>
        ))}
      </div>

      {sessions.length === 0 && (
        <p className="empty-sessions">No conversations yet.</p>
      )}
    </section>
  );
}
