import { useEffect, useRef, useState } from 'react';
import ChatHeader from './components/ChatHeader.tsx';
import MessageList, {
  type ChatMessage,
} from './components/MessageList.tsx';
import PromptComposer from './components/PromptComposer.tsx';
import SessionList, {
  type ChatSession,
} from './components/SessionList.tsx';
import AuthScreen from './components/auth/AuthScreen.tsx';
import WorkspaceSelector from './components/workspace/WorkspaceSelector.tsx';
import WorkspaceModal from './components/workspace/WorkspaceModal.tsx';
import type { AuthMode, AuthUser } from './types/auth.ts';
import type {
  UserSearchResult,
  Workspace,
  WorkspaceDetails,
  WorkspaceRole,
} from './types/workspace.ts';
import { ShieldCheck } from 'lucide-react';

interface HostMessage {
  type:
    | 'assistant.reply'
    | 'task.cancelled'
    | 'task.error'
    | 'backend.health.result'
    | 'auth.result'
    | 'workspace.result'
    | 'user.search.result';
  text?: string;
  requestId?: string;
  ok?: boolean;
  status?: number;
  operation?: string;
  user?: AuthUser | null;
  data?: any;
  pagination?: any;
  error?: {
    code?: string;
    status?: number;
    message?: string;
  };
}

interface PendingRequest {
  sessionId: string;
  requestId: string;
}

const vscode =
  typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function'
    ? window.acquireVsCodeApi()
    : {
        postMessage: (message: unknown) => {
          console.log('[SADS webview mock vscode.postMessage]:', message);
        },
        getState: () => ({}),
        setState: () => {},
      };

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function App() {
  const [initialSessionId] = useState(() => createId());

  // Authentication State
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authRestoring, setAuthRestoring] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Backend Health Status
  const [backendStatus, setBackendStatus] = useState('Not tested');

  // Workspace State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeWorkspaceDetails, setActiveWorkspaceDetails] =
    useState<WorkspaceDetails | null>(null);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [workspaceModalTab, setWorkspaceModalTab] = useState<
    'workspaces' | 'details' | 'members' | 'create'
  >('workspaces');
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [detectedPath, setDetectedPath] = useState<string>('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Chat State
  const [sessions, setSessions] = useState<ChatSession[]>([
    { id: initialSessionId, title: 'New conversation' },
  ]);
  const [activeSessionId, setActiveSessionId] = useState(initialSessionId);
  const [messagesBySession, setMessagesBySession] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [busy, setBusy] = useState(false);
  const pending = useRef<PendingRequest | null>(null);

  // Determine current user's role in active workspace
  const activeRole: WorkspaceRole | undefined =
    activeWorkspaceDetails?.members.find((m) => m.userId === user?.id)?.role;

  // Filter conversations for the active workspace
  const currentWorkspaceSessions = sessions.filter(
    (s) =>
      !s.workspaceId ||
      !activeWorkspaceId ||
      s.workspaceId === activeWorkspaceId,
  );

  const messages = messagesBySession[activeSessionId] ?? [];

  function testBackendConnection() {
    setBackendStatus('Checking backend...');

    vscode.postMessage({
      type: 'backend.health',
      requestId: createId(),
    });
  }

  function addMessage(sessionId: string, message: ChatMessage) {
    setMessagesBySession((current) => ({
      ...current,
      [sessionId]: [...(current[sessionId] ?? []), message],
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
      {
        id,
        title: 'New conversation',
        workspaceId: activeWorkspaceId ?? undefined,
      },
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
        session.id === sessionId && session.title === 'New conversation'
          ? {
              ...session,
              title: text.slice(0, 36),
            }
          : session,
      ),
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

  // Auth Handlers
  function handleLogin({ email, password }: { email: string; password: string }) {
    setAuthSubmitting(true);
    setAuthError(null);

    const requestId = createId();
    vscode.postMessage({
      type: 'auth.login',
      requestId,
      email,
      password,
    });
  }

  function handleRegister({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) {
    setAuthSubmitting(true);
    setAuthError(null);

    const requestId = createId();
    vscode.postMessage({
      type: 'auth.register',
      requestId,
      email,
      password,
    });
  }

  function handleLogout() {
    if (pending.current) {
      cancelRequest();
      pending.current = null;
      setBusy(false);
    }

    const requestId = createId();
    vscode.postMessage({
      type: 'auth.logout',
      requestId,
    });

    setUser(null);
    setAuthError(null);
    setAuthMode('login');
    setWorkspaces([]);
    setActiveWorkspaceId(null);
    setActiveWorkspaceDetails(null);
  }

  // Workspace Messaging Handlers
  function loadWorkspaces() {
    setWorkspacesLoading(true);
    vscode.postMessage({
      type: 'workspace.list',
      requestId: createId(),
    });
  }

  function loadWorkspaceDetails(workspaceId: string) {
    vscode.postMessage({
      type: 'workspace.get',
      requestId: createId(),
      workspaceId,
    });
  }

  function handleCreateWorkspace(data: { name: string; rootPath: string }) {
    setWorkspacesLoading(true);
    setWorkspaceError(null);
    vscode.postMessage({
      type: 'workspace.create',
      requestId: createId(),
      name: data.name,
      rootPath: data.rootPath,
    });
  }

  function handleUpdateWorkspace(data: { name?: string; rootPath?: string }) {
    if (!activeWorkspaceId) return;
    setWorkspacesLoading(true);
    setWorkspaceError(null);
    vscode.postMessage({
      type: 'workspace.update',
      requestId: createId(),
      workspaceId: activeWorkspaceId,
      name: data.name,
      rootPath: data.rootPath,
    });
  }

  function handleDeleteWorkspace(workspaceId: string) {
    setWorkspacesLoading(true);
    setWorkspaceError(null);
    vscode.postMessage({
      type: 'workspace.delete',
      requestId: createId(),
      workspaceId,
    });
  }

  function handleAddWorkspaceMember(
    userId: string,
    role: 'ADMIN' | 'DEVELOPER' | 'VIEWER',
  ) {
    if (!activeWorkspaceId) return;
    setWorkspacesLoading(true);
    setWorkspaceError(null);
    vscode.postMessage({
      type: 'workspace.member.add',
      requestId: createId(),
      workspaceId: activeWorkspaceId,
      userId,
      role,
    });
  }

  function handleRemoveWorkspaceMember(userId: string) {
    if (!activeWorkspaceId) return;
    setWorkspacesLoading(true);
    setWorkspaceError(null);
    vscode.postMessage({
      type: 'workspace.member.remove',
      requestId: createId(),
      workspaceId: activeWorkspaceId,
      userId,
    });
  }

  function handleUpdateWorkspaceMemberRole(
    userId: string,
    role: 'ADMIN' | 'DEVELOPER' | 'VIEWER',
  ) {
    if (!activeWorkspaceId) return;
    setWorkspacesLoading(true);
    setWorkspaceError(null);
    vscode.postMessage({
      type: 'workspace.member.updateRole',
      requestId: createId(),
      workspaceId: activeWorkspaceId,
      userId,
      role,
    });
  }

  function handleSearchUsers(query: string) {
    setSearchLoading(true);
    setWorkspaceError(null);
    vscode.postMessage({
      type: 'user.search',
      requestId: createId(),
      query,
      workspaceId: activeWorkspaceId || undefined,
    });
  }

  function requestDetectPath() {
    vscode.postMessage({
      type: 'workspace.detectPath',
      requestId: createId(),
    });
  }

  function handleSelectWorkspace(workspaceId: string) {
    setActiveWorkspaceId(workspaceId);
    loadWorkspaceDetails(workspaceId);
  }

  // Restore session when webview loads
  useEffect(() => {
    const requestId = createId();
    vscode.postMessage({
      type: 'auth.restore',
      requestId,
    });

    const timer = setTimeout(() => {
      setAuthRestoring((current) => (current ? false : current));
    }, 6000);

    return () => clearTimeout(timer);
  }, []);

  // When user is authenticated, load workspaces and detect path
  useEffect(() => {
    if (user) {
      loadWorkspaces();
      requestDetectPath();
    }
  }, [user]);

  // Load details when activeWorkspaceId changes
  useEffect(() => {
    if (activeWorkspaceId) {
      loadWorkspaceDetails(activeWorkspaceId);
    } else {
      setActiveWorkspaceDetails(null);
    }
  }, [activeWorkspaceId]);

  // Handle incoming messages from VS Code extension host
  useEffect(() => {
    function handleMessage(event: MessageEvent<HostMessage>) {
      const message = event.data;
      if (!message || typeof message.type !== 'string') return;

      // 1. Backend health check result
      if (message.type === 'backend.health.result') {
        setBackendStatus(
          message.ok
            ? `Connected (HTTP ${message.status})`
            : `Connection failed: ${message.text ?? 'Unknown error'}`,
        );
        return;
      }

      // 2. Authentication result
      if (message.type === 'auth.result') {
        const operation = message.operation;

        if (operation === 'auth.restore') {
          setAuthRestoring(false);
          if (message.ok && message.user) {
            setUser(message.user);
          } else {
            setUser(null);
          }
          return;
        }

        if (operation === 'auth.login' || operation === 'auth.register') {
          setAuthSubmitting(false);

          if (message.ok && message.user) {
            setUser(message.user);
            setAuthError(null);
          } else {
            const defaultMsg =
              operation === 'auth.login'
                ? 'Invalid email or password.'
                : 'Registration failed. Please try again.';

            setAuthError(message.error?.message || defaultMsg);
          }
          return;
        }

        if (operation === 'auth.logout') {
          setAuthSubmitting(false);
          setUser(null);
          setAuthError(null);
          setAuthMode('login');
          return;
        }

        if (operation === 'auth.me') {
          if (message.ok && message.user) {
            setUser(message.user);
          }
          return;
        }

        return;
      }

      // 3. Workspace result
      if (message.type === 'workspace.result') {
        setWorkspacesLoading(false);

        if (!message.ok) {
          setWorkspaceError(
            message.error?.message || 'Workspace operation failed.',
          );
          return;
        }

        const operation = message.operation;

        if (operation === 'workspace.detectPath') {
          setDetectedPath(message.data?.path || '');
          return;
        }

        if (operation === 'workspace.list') {
          const list: Workspace[] = Array.isArray(message.data)
            ? message.data
            : [];
          setWorkspaces(list);

          // If no active workspace or active not in list, select first
          if (list.length > 0) {
            setActiveWorkspaceId((current) => {
              if (current && list.some((w) => w.id === current)) {
                return current;
              }
              return list[0].id;
            });
          } else {
            setActiveWorkspaceId(null);
            setActiveWorkspaceDetails(null);
          }
          return;
        }

        if (operation === 'workspace.get') {
          setActiveWorkspaceDetails(message.data as WorkspaceDetails);
          return;
        }

        if (operation === 'workspace.create') {
          const newWs = message.data as Workspace;
          setWorkspaces((prev) => [newWs, ...prev]);
          setActiveWorkspaceId(newWs.id);
          loadWorkspaceDetails(newWs.id);
          setWorkspaceModalTab('details');
          return;
        }

        if (operation === 'workspace.update') {
          const updated = message.data as Workspace;
          setWorkspaces((prev) =>
            prev.map((w) => (w.id === updated.id ? updated : w)),
          );
          if (activeWorkspaceId === updated.id) {
            loadWorkspaceDetails(updated.id);
          }
          return;
        }

        if (operation === 'workspace.delete') {
          const deletedId = message.data?.workspaceId;
          setWorkspaces((prev) => {
            const next = prev.filter((w) => w.id !== deletedId);
            if (activeWorkspaceId === deletedId) {
              const nextActive = next[0]?.id || null;
              setActiveWorkspaceId(nextActive);
              if (nextActive) loadWorkspaceDetails(nextActive);
            }
            return next;
          });
          setWorkspaceModalTab('workspaces');
          return;
        }

        if (
          operation === 'workspace.member.add' ||
          operation === 'workspace.member.remove' ||
          operation === 'workspace.member.updateRole'
        ) {
          if (activeWorkspaceId) {
            loadWorkspaceDetails(activeWorkspaceId);
          }
          // Clear user search results on successful add
          if (operation === 'workspace.member.add') {
            setSearchResults([]);
          }
          return;
        }

        return;
      }

      // 4. User search result
      if (message.type === 'user.search.result') {
        setSearchLoading(false);
        if (message.ok) {
          setSearchResults(
            Array.isArray(message.data) ? message.data : [],
          );
        } else {
          setWorkspaceError(
            message.error?.message || 'Failed to search users.',
          );
        }
        return;
      }

      // 5. Chat tasks
      if (
        message.type !== 'assistant.reply' &&
        message.type !== 'task.cancelled' &&
        message.type !== 'task.error'
      ) {
        return;
      }

      if (!pending.current || message.requestId !== pending.current.requestId) {
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
  }, [activeWorkspaceId]);

  // 1. Initial Session Restoration Loading Screen
  if (authRestoring) {
    return (
      <div className="auth-container">
        <div className="auth-card session-restore-card">
          <div className="auth-brand-icon restore-icon" aria-hidden="true">
            <ShieldCheck size={32} />
          </div>
          <div className="auth-brand-text">
            <h1 className="auth-brand-title">SADS</h1>
            <p className="auth-brand-subtitle">
              Security-Aware Dependency Selection
            </p>
          </div>
          <div className="auth-restore-indicator" role="status">
            <div className="loading-dot" />
            <span>Restoring session...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: Render Login / Register screens
  if (!user) {
    return (
      <AuthScreen
        mode={authMode}
        loading={authSubmitting}
        errorMessage={authError}
        backendStatus={backendStatus}
        onClearError={() => setAuthError(null)}
        onSwitchMode={(mode) => {
          setAuthMode(mode);
          setAuthError(null);
        }}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onTestBackend={testBackendConnection}
      />
    );
  }

  // 3. Authenticated: Render Chat application with Workspace Selector & Manager
  return (
    <div className="sads-app">
      <ChatHeader
        onNewChat={newChat}
        user={user}
        onLogout={handleLogout}
      />

      {/* Workspace Selector Bar */}
      <WorkspaceSelector
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        activeRole={activeRole}
        loading={workspacesLoading}
        onSelectWorkspace={handleSelectWorkspace}
        onOpenManager={(tab) => {
          setWorkspaceModalTab(tab);
          setWorkspaceModalOpen(true);
        }}
      />

      {/* Backend connection test */}
      <div className="backend-connection">
        <button type="button" onClick={testBackendConnection}>
          Test Backend Connection
        </button>

        <span role="status">{backendStatus}</span>
      </div>

      <div className="workspace">
        <SessionList
          sessions={currentWorkspaceSessions}
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

      {/* Workspace Modal Dialog */}
      <WorkspaceModal
        isOpen={workspaceModalOpen}
        onClose={() => setWorkspaceModalOpen(false)}
        tab={workspaceModalTab}
        onTabChange={setWorkspaceModalTab}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        activeWorkspaceDetails={activeWorkspaceDetails}
        currentUserId={user.id}
        loading={workspacesLoading}
        onSelectWorkspace={handleSelectWorkspace}
        onCreateWorkspace={handleCreateWorkspace}
        onUpdateWorkspace={handleUpdateWorkspace}
        onDeleteWorkspace={handleDeleteWorkspace}
        onSearchUsers={handleSearchUsers}
        searchResults={searchResults}
        searchLoading={searchLoading}
        onAddMember={handleAddWorkspaceMember}
        onRemoveMember={handleRemoveWorkspaceMember}
        onUpdateMemberRole={handleUpdateWorkspaceMemberRole}
        detectedPath={detectedPath}
        onRequestDetectPath={requestDetectPath}
        errorMessage={workspaceError}
        onClearError={() => setWorkspaceError(null)}
      />
    </div>
  );
}
