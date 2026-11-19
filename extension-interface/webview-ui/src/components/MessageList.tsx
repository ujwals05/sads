import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ShieldCheck,
  User,
  Wrench,
  XCircle,
} from 'lucide-react';
import { useEffect, useRef } from 'react';

export interface ChatToolCall {
  id: string;
  name: string;
  summary: string;
}

export interface ChatToolResult {
  toolUseId: string;
  isError: boolean;
  preview: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'error';
  text: string;
  toolCalls?: ChatToolCall[];
  toolResults?: ChatToolResult[];
}

interface MessageListProps {
  messages: ChatMessage[];
  busy: boolean;
  activity?: string;
  loading?: boolean;
  onQuickPrompt?: (text: string) => void;
}

const QUICK_PROMPTS = [
  'Analyse this project: explain its architecture, main modules and how they connect.',
  'Review the dependencies in this project and flag any that look risky or unnecessary.',
  'Find likely bugs or missing error handling in this codebase.',
];

/** Maps tool_use ids to their results across the whole conversation. */
function indexResults(messages: ChatMessage[]): Map<string, ChatToolResult> {
  const map = new Map<string, ChatToolResult>();
  for (const message of messages) {
    for (const result of message.toolResults ?? []) {
      map.set(result.toolUseId, result);
    }
  }
  return map;
}

export default function MessageList({
  messages,
  busy,
  activity,
  loading,
  onQuickPrompt,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy, activity]);

  if (loading) {
    return (
      <main className="conversation empty-conversation">
        <div className="working-indicator" role="status">
          <span className="loading-dot" />
          Loading conversation…
        </div>
      </main>
    );
  }

  if (messages.length === 0 && !busy) {
    return (
      <main className="conversation empty-conversation">
        <div className="welcome-mark">
          <ShieldCheck size={30} />
        </div>

        <h2>What are we building?</h2>
        <p>
          SADS reads your open project, plans and makes changes with your
          approval, and sends every new dependency through a security review.
        </p>

        {onQuickPrompt && (
          <div className="quick-prompts">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="quick-prompt"
                onClick={() => onQuickPrompt(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </main>
    );
  }

  const results = indexResults(messages);

  return (
    <main className="conversation">
      {messages.map((message) => {
        // Tool results are shown inline next to the call that produced them.
        if (message.role === 'tool') return null;

        if (message.role === 'error') {
          return (
            <div key={message.id} className="agent-error" role="alert">
              <AlertTriangle size={14} />
              <span>{message.text}</span>
            </div>
          );
        }

        return (
          <article key={message.id} className={`message ${message.role}`}>
            <div className="message-avatar">
              {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>

            <div className="message-content">
              <div className="message-author">
                {message.role === 'user' ? 'You' : 'SADS'}
              </div>
              {message.text && <div className="message-text">{message.text}</div>}

              {message.toolCalls && message.toolCalls.length > 0 && (
                <ul className="tool-calls">
                  {message.toolCalls.map((call) => {
                    const result = results.get(call.id);
                    return (
                      <li
                        key={call.id}
                        className={`tool-call ${result?.isError ? 'failed' : ''}`}
                        title={result?.preview || undefined}
                      >
                        {!result ? (
                          <Wrench size={12} />
                        ) : result.isError ? (
                          <XCircle size={12} />
                        ) : (
                          <CheckCircle2 size={12} />
                        )}
                        <span>{call.summary}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </article>
        );
      })}

      {busy && (
        <div className="working-indicator" role="status">
          <span className="loading-dot" />
          {activity || 'SADS is thinking…'}
        </div>
      )}

      <div ref={bottomRef} />
    </main>
  );
}
