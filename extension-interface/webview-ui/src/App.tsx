
import { useEffect, useRef, useState } from 'react';
import ChatHeader from './components/ChatHeader.tsx';
import MessageList, {
  type ChatMessage,
} from './components/MessageList.tsx';
import PromptComposer from './components/PromptComposer.tsx';
import SessionList, {
  type ChatSession,
} from './components/SessionList.tsx';


interface HostMessage {
  type: 'assistant.reply' | 'task.cancelled' | 'task.error';
  text?: string;
  requestId?: string;
}

interface PendingRequest {
  sessionId: string;
  requestId: string;
}

const vscode = window.acquireVsCodeApi();

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function App() {
  const initialId = useRef(createId());

  const [sessions, setSessions] = useState<ChatSession[]>([
    { id: initialId.current, title: 'New conversation' },
  ]);
  const [activeSessionId, setActiveSessionId] =
    useState(initialId.current);
  const [messagesBySession, setMessagesBySession] =
    useState<Record<string, ChatMessage[]>>({});
  const [busy, setBusy] = useState(false);
  const pending = useRef<PendingRequest | null>(null);

  const messages = messagesBySession[activeSessionId] ?? [];

  function addMessage(sessionId: string, message: ChatMessage) {
    setMessagesBySession((current) => ({
      ...current,
      [sessionId]: [
        ...(current[sessionId] ?? []),
        message,
      ],
    }));
  }

  function newChat() {
    if (pending.current) {
      vscode.postMessage({
        type: 'task.cancel',
        requestId: pending.current.requestId,
      });
      pending.current = null;
    }

    setBusy(false);

    const id = createId();
    setSessions((current) => [
      { id, title: 'New conversation' },
      ...current,
    ]);
    setActiveSessionId(id);
  }

  function sendPrompt(text: string) {
    if (busy) return;

    const requestId = createId();
    const sessionId = activeSessionId;

    addMessage(sessionId, {
      id: createId(),
      role: 'user',
      text,
    });

    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId &&
        session.title === 'New conversation'
          ? {
              ...session,
              title: text.slice(0, 36),
            }
          : session
      )
    );

    pending.current = { sessionId, requestId };
    setBusy(true);

    vscode.postMessage({
      type: 'chat.prompt',
      requestId,
      sessionId,
      text,
    });
  }

  function cancelRequest() {
    if (pending.current) {
      vscode.postMessage({
        type: 'task.cancel',
        requestId: pending.current.requestId,
      });
    }
  }

  useEffect(() => {
    function handleMessage(event: MessageEvent<HostMessage>) {
      const message = event.data;

      if (
        message.type !== 'assistant.reply' &&
        message.type !== 'task.cancelled' &&
        message.type !== 'task.error'
      ) {
        return;
      }

      if (
        !pending.current ||
        message.requestId !== pending.current.requestId
      ) {
        return;
      }

      const sessionId = pending.current.sessionId;
      pending.current = null;
      setBusy(false);

      if (message.type === 'assistant.reply') {
        addMessage(sessionId, {
          id: createId(),
          role: 'assistant',
          text: message.text ?? 'No response was returned.',
        });
      } else if (message.type === 'task.error') {
        addMessage(sessionId, {
          id: createId(),
          role: 'assistant',
          text: `Something went wrong: ${message.text ?? 'Unknown error'}`,
        });
      }
    }

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <div className="sads-app">
      <ChatHeader onNewChat={newChat} />

      <div className="workspace">
        <SessionList
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={(id) => {
            if (pending.current) return;
            setActiveSessionId(id);
          }}
          onNewChat={newChat}
        />

        <div className="chat-panel">
          <MessageList messages={messages} busy={busy} />
          <PromptComposer
            busy={busy}
            onSend={sendPrompt}
            onCancel={cancelRequest}
          />
        </div>
      </div>
    </div>
  );
}
