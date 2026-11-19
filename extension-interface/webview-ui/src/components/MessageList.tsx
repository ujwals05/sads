
import { Bot, User, ShieldCheck } from 'lucide-react';
import { useEffect, useRef } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Sender label for messages written by other workspace members. */
  author?: string;
}

interface MessageListProps {
  messages: ChatMessage[];
  busy: boolean;
  loadingHistory?: boolean;
  scopeLabel?: string;
}

export default function MessageList({
  messages,
  busy,
  loadingHistory = false,
  scopeLabel,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  if (loadingHistory && messages.length === 0) {
    return (
      <main className="conversation empty-conversation">
        <div className="working-indicator" role="status">
          <span className="loading-dot" />
          Loading conversation…
        </div>
      </main>
    );
  }

  if (messages.length === 0) {
    return (
      <main className="conversation empty-conversation">
        <div className="welcome-mark">
          <ShieldCheck size={30} />
        </div>

        <h2>What are we building?</h2>
        {scopeLabel && <span className="scope-chip">{scopeLabel}</span>}
        <p>
          Describe your idea. SADS will help plan the implementation
          and evaluate dependencies before installation.
        </p>

        <div className="capability-list">
          <div>
            <Bot size={16} />
            <span>Plan and generate code</span>
          </div>
          <div>
            <ShieldCheck size={16} />
            <span>Evaluate package risks</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="conversation">
      {messages.map((message) => (
        <article
          key={message.id}
          className={`message ${message.role}`}
        >
          <div className="message-avatar">
            {message.role === 'user'
              ? <User size={16} />
              : <Bot size={16} />}
          </div>

          <div className="message-content">
            <div className="message-author">
              {message.role === 'user' ? message.author ?? 'You' : 'SADS'}
            </div>
            <div className="message-text">{message.text}</div>
          </div>
        </article>
      ))}

      {busy && (
        <div className="working-indicator" role="status">
          <span className="loading-dot" />
          SADS is thinking…
        </div>
      )}

      <div ref={bottomRef} />
    </main>
  );
}
