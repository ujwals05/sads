import { useCallback, useEffect, useRef, useState } from 'react';
import ChatHeader from './components/ChatHeader.tsx';
import MessageList, { type ChatMessage } from './components/MessageList.tsx';
import PromptComposer from './components/PromptComposer.tsx';
import SessionList from './components/SessionList.tsx';
import AuthScreen from './components/auth/AuthScreen.tsx';
import WorkspaceSelector from './components/workspace/WorkspaceSelector.tsx';
import WorkspaceModal from './components/workspace/WorkspaceModal.tsx';
import type { AuthMode, AuthUser } from './types/auth.ts';
import type {
  AssignableRole,
  Notice,
  UserSearchResult,
  Workspace,
  WorkspaceDetails,
  WorkspaceInput,
  WorkspaceModalTab,
  WorkspaceRole,
} from './types/workspace.ts';
import type {
  Conversation,
  ConversationDetails,
  MessageExchange,
} from './types/conversation.ts';
import { ROLE_LABELS, canModifyConversation } from './lib/permissions.ts';
import {
  isSameScope,
  toChatMessages,
  upsertConversation,
} from './lib/conversations.ts';
import {
  createId,
  persistState,
  readPersistedState,
  vscode,
} from './lib/vscode.ts';
import { ShieldCheck } from 'lucide-react';

interface HostError {
  code?: string;
  status?: number;
  message?: string;
}

interface HostMessage {
  type:
    | 'assistant.reply'
    | 'task.cancelled'
    | 'task.error'
    | 'backend.health.result'
    | 'auth.result'
    | 'workspace.result'
    | 'conversation.result'
    | 'user.search.result';
  text?: string;
  requestId?: string;
  ok?: boolean;
  status?: number;
  operation?: string;
  user?: AuthUser | null;
  data?: any;
  context?: { workspaceId?: string | null; conversationId?: string };
  error?: HostError;
}

interface PendingRequest {
  conversationId: string;
  requestId: string;
}

/** Messages shown when a workspace operation succeeds, keyed by request id. */
type SuccessMessages = Map<string, string>;

const persisted = readPersistedState();

function post(type: string, payload: Record<string, unknown> = {}): string {
  const requestId = createId();
  vscode.postMessage({ type, requestId, ...payload });
  return requestId;
}

export default function App() {
  // Authentication
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authRestoring, setAuthRestoring] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState('Not tested');

  // Workspaces
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);
  const [workspacesError, setWorkspacesError] = useState<string | null>(null);
  const [workspacesReady, setWorkspacesReady] = useState(false);
  // null = personal chats.
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    persisted.workspaceId ?? null,
  );
  const [activeWorkspaceDetails, setActiveWorkspaceDetails] =
    useState<WorkspaceDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [workspaceModalTab, setWorkspaceModalTab] =
    useState<WorkspaceModalTab>('workspaces');
  const [mutating, setMutating] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [detectedPath, setDetectedPath] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState('');

  // Conversations (chat sessions) for the active scope
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messagesByConversation, setMessagesByConversation] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Refs read by the (once-registered) host message listener.
  const pending = useRef<PendingRequest | null>(null);
  const pendingPrompt = useRef<string | null>(null);
  const scopeRef = useRef<string | null>(activeWorkspaceId);
  const scopeChosenRef = useRef(persisted.workspaceId !== undefined);
  const activeConversationRef = useRef<string | null>(null);
  const loadedConversations = useRef(new Set<string>());
  const userRef = useRef<AuthUser | null>(null);
  const workspacesRef = useRef<Workspace[]>([]);
  const successMessages = useRef<SuccessMessages>(new Map());
  const latestSearch = useRef<{ requestId: string; query: string } | null>(null);

  useEffect(() => {
    userRef.current = user;
    workspacesRef.current = workspaces;
  }, [user, workspaces]);

  const activeRole: WorkspaceRole | null =
    (activeWorkspaceDetails?.id === activeWorkspaceId ? activeWorkspaceDetails?.role : null) ??
    workspaces.find((w) => w.id === activeWorkspaceId)?.role ??
    null;
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  const messages = activeConversationId
    ? messagesByConversation[activeConversationId] ?? []
    : [];

  // ---------------------------------------------------------------- helpers

  function selectConversation(id: string | null) {
    activeConversationRef.current = id;
    setActiveConversationId(id);
    if (id && !loadedConversations.current.has(id)) {
      setHistoryLoadingId(id);
      post('conversation.get', { conversationId: id });
    }
  }

  function addMessage(conversationId: string, message: ChatMessage) {
    setMessagesByConversation((current) => ({
      ...current,
      [conversationId]: [...(current[conversationId] ?? []), message],
    }));
  }

  function cancelPending() {
    if (pending.current) {
      vscode.postMessage({ type: 'task.cancel', requestId: pending.current.requestId });
      pending.current = null;
    }
    pendingPrompt.current = null;
    setBusy(false);
  }

  function loadWorkspaces() {
    setWorkspacesLoading(true);
    setWorkspacesError(null);
    post('workspace.list');
  }

  function loadWorkspaceDetails(workspaceId: string) {
    setDetailsLoading(true);
    post('workspace.get', { workspaceId });
  }

  function loadConversations(scope: string | null) {
    setConversationsLoading(true);
    setConversationsError(null);
    post('conversation.list', { workspaceId: scope });
  }

  function workspaceOp(type: string, payload: Record<string, unknown>, success?: string) {
    setMutating(true);
    setNotice(null);
    const requestId = post(type, payload);
    if (success) successMessages.current.set(requestId, success);
  }

  const selectScope = useCallback((workspaceId: string | null) => {
    scopeChosenRef.current = true;
    setActiveWorkspaceId(workspaceId);
  }, []);

  function resetAppState() {
    cancelPending();
    setWorkspaces([]);
    setWorkspacesReady(false);
    setActiveWorkspaceDetails(null);
    setConversations([]);
    setMessagesByConversation({});
    loadedConversations.current.clear();
    activeConversationRef.current = null;
    setActiveConversationId(null);
    setSearchResults([]);
    setNotice(null);
    setWorkspaceModalOpen(false);
  }

  // ------------------------------------------------------------ chat actions

  function dispatchPrompt(conversationId: string, text: string) {
    const requestId = createId();
    addMessage(conversationId, { id: `local-${requestId}`, role: 'user', text });
    pending.current = { conversationId, requestId };
    setBusy(true);
    vscode.postMessage({ type: 'chat.prompt', requestId, conversationId, text });
  }

  function sendPrompt(text: string) {
    if (busy) return;
    const conversationId = activeConversationRef.current;
    if (conversationId) {
      dispatchPrompt(conversationId, text);
      return;
    }
    // No conversation yet: create one in the current scope, then send.
    pendingPrompt.current = text;
    setBusy(true);
    post('conversation.create', { workspaceId: scopeRef.current });
  }

  function newChat() {
    cancelPending();
    const current = activeConversationRef.current;
    // Reuse an empty conversation instead of piling up blank ones.
    if (current && loadedConversations.current.has(current) && messages.length === 0) {
      return;
    }
    post('conversation.create', { workspaceId: scopeRef.current });
  }

  function cancelRequest() {
    if (pending.current) {
      vscode.postMessage({ type: 'task.cancel', requestId: pending.current.requestId });
    }
  }

  // ------------------------------------------------------------ auth actions

  function testBackendConnection() {
    setBackendStatus('Checking backend...');
    post('backend.health');
  }

  function handleLogin({ email, password }: { email: string; password: string }) {
    setAuthSubmitting(true);
    setAuthError(null);
    post('auth.login', { email, password });
  }

  function handleRegister({ email, password }: { email: string; password: string }) {
    setAuthSubmitting(true);
    setAuthError(null);
    post('auth.register', { email, password });
  }

  function handleLogout() {
    resetAppState();
    post('auth.logout');
    setUser(null);
    setAuthError(null);
    setAuthMode('login');
  }

  // ------------------------------------------------------- workspace actions

  function handleCreateWorkspace(data: WorkspaceInput) {
    workspaceOp('workspace.create', { ...data }, `Workspace "${data.name}" created. You are its owner.`);
  }

  function handleUpdateWorkspace(data: Partial<WorkspaceInput>) {
    if (!activeWorkspaceId) return;
    workspaceOp('workspace.update', { workspaceId: activeWorkspaceId, ...data }, 'Workspace settings saved.');
  }

  function handleDeleteWorkspace(workspaceId: string) {
    workspaceOp('workspace.delete', { workspaceId }, 'Workspace deleted.');
  }

  function handleAddMember(target: UserSearchResult, role: AssignableRole) {
    if (!activeWorkspaceId) return;
    workspaceOp(
      'workspace.member.add',
      { workspaceId: activeWorkspaceId, userId: target.id, role },
      `Added ${target.email} as ${ROLE_LABELS[role]}.`,
    );
  }

  function handleRemoveMember(userId: string, email: string) {
    if (!activeWorkspaceId) return;
    const self = userId === user?.id;
    workspaceOp(
      'workspace.member.remove',
      { workspaceId: activeWorkspaceId, userId },
      self ? `You left ${activeWorkspace?.name ?? 'the workspace'}.` : `Removed ${email} from the workspace.`,
    );
  }

  function handleUpdateMemberRole(userId: string, email: string, role: AssignableRole) {
    if (!activeWorkspaceId) return;
    workspaceOp(
      'workspace.member.updateRole',
      { workspaceId: activeWorkspaceId, userId, role },
      `${email} is now ${ROLE_LABELS[role]}.`,
    );
  }

  function handleTransferOwnership(userId: string, email: string) {
    if (!activeWorkspaceId) return;
    workspaceOp(
      'workspace.transferOwnership',
      { workspaceId: activeWorkspaceId, userId },
      `${email} is now the owner. You are an admin.`,
    );
  }

  function handleSearchUsers(query: string) {
    if (!activeWorkspaceId) return;
    setSearchLoading(true);
    const requestId = post('user.search', { query, workspaceId: activeWorkspaceId });
    latestSearch.current = { requestId, query };
  }

  // --------------------------------------------------------------- effects

  // Restore the session when the webview loads.
  useEffect(() => {
    post('auth.restore');
    const timer = setTimeout(() => {
      setAuthRestoring((current) => (current ? false : current));
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  // Once authenticated, load workspaces and detect the VS Code folder.
  useEffect(() => {
    if (user) {
      loadWorkspaces();
      post('workspace.detectPath');
    }
  }, [user]);

  // Whenever the scope changes, load its details and chat sessions.
  useEffect(() => {
    scopeRef.current = activeWorkspaceId;
    if (!user || !workspacesReady) return;

    persistState({ workspaceId: activeWorkspaceId });
    cancelPending();
    activeConversationRef.current = null;
    setActiveConversationId(null);
    setConversations([]);
    setSearchResults([]);
    setSearchedQuery('');

    if (activeWorkspaceId) {
      loadWorkspaceDetails(activeWorkspaceId);
    } else {
      setActiveWorkspaceDetails(null);
    }
    loadConversations(activeWorkspaceId);
    // Only the scope (and readiness) should trigger a reload.
  }, [activeWorkspaceId, user, workspacesReady]);

  // Messages from the extension host.
  useEffect(() => {
    function onWorkspaceResult(message: HostMessage) {
      const operation = message.operation;
      const success = message.requestId
        ? successMessages.current.get(message.requestId)
        : undefined;
      if (message.requestId) successMessages.current.delete(message.requestId);

      if (operation === 'workspace.list') {
        setWorkspacesLoading(false);
        if (!message.ok) {
          setWorkspacesError(message.error?.message || 'Could not load workspaces.');
          setWorkspacesReady(true);
          return;
        }
        const list: Workspace[] = Array.isArray(message.data) ? message.data : [];
        setWorkspaces(list);

        const current = scopeRef.current;
        let next: string | null;
        if (current && list.some((w) => w.id === current)) next = current;
        else if (current === null && scopeChosenRef.current) next = null;
        else next = list[0]?.id ?? null;

        setActiveWorkspaceId(next);
        setWorkspacesReady(true);
        return;
      }

      if (operation === 'workspace.detectPath') {
        if (message.ok) setDetectedPath(message.data?.path || '');
        return;
      }

      if (operation === 'workspace.get') {
        setDetailsLoading(false);
        if (!message.ok) {
          // Lost access (removed / deleted): fall back to another scope.
          if (message.error?.status === 404) {
            setNotice({ kind: 'error', text: 'You no longer have access to that workspace.' });
            scopeChosenRef.current = false;
            scopeRef.current = null;
            loadWorkspaces();
          } else {
            setNotice({ kind: 'error', text: message.error?.message || 'Could not load workspace.' });
          }
          return;
        }
        const details = message.data as WorkspaceDetails;
        if (details.id === scopeRef.current) setActiveWorkspaceDetails(details);
        return;
      }

      // Mutations
      setMutating(false);

      if (!message.ok) {
        setNotice({ kind: 'error', text: message.error?.message || 'Workspace operation failed.' });
        return;
      }

      if (success) setNotice({ kind: 'success', text: success });
      const scope = scopeRef.current;

      switch (operation) {
        case 'workspace.create': {
          const created = message.data as Workspace;
          setWorkspaces((prev) => [created, ...prev.filter((w) => w.id !== created.id)]);
          selectScope(created.id);
          setWorkspaceModalTab('members');
          break;
        }
        case 'workspace.update': {
          const updated = message.data as Workspace;
          setWorkspaces((prev) =>
            prev.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)),
          );
          if (scope === updated.id) loadWorkspaceDetails(updated.id);
          break;
        }
        case 'workspace.delete': {
          const deletedId = message.data?.workspaceId as string;
          const remaining = workspacesRef.current.filter((w) => w.id !== deletedId);
          setWorkspaces(remaining);
          if (scope === deletedId) selectScope(remaining[0]?.id ?? null);
          setWorkspaceModalTab('workspaces');
          break;
        }
        case 'workspace.member.remove': {
          const removedId = message.data?.userId as string;
          if (removedId === userRef.current?.id) {
            // Left the workspace.
            const remaining = workspacesRef.current.filter((w) => w.id !== scope);
            setWorkspaces(remaining);
            selectScope(remaining[0]?.id ?? null);
            setWorkspaceModalTab('workspaces');
          } else if (scope) {
            loadWorkspaceDetails(scope);
            loadWorkspaces();
          }
          break;
        }
        case 'workspace.member.add': {
          const addedId = message.data?.userId as string;
          setSearchResults((prev) => prev.filter((u) => u.id !== addedId));
          if (scope) loadWorkspaceDetails(scope);
          loadWorkspaces();
          break;
        }
        case 'workspace.member.updateRole':
        case 'workspace.transferOwnership': {
          if (scope) loadWorkspaceDetails(scope);
          loadWorkspaces();
          break;
        }
      }
    }

    function onConversationResult(message: HostMessage) {
      const operation = message.operation;
      const contextScope = message.context?.workspaceId;

      if (!message.ok) {
        const text = message.error?.message || 'Conversation operation failed.';
        if (operation === 'conversation.list') {
          if (!isSameScope(contextScope, scopeRef.current)) return;
          setConversationsLoading(false);
          setConversationsError(text);
          return;
        }
        if (operation === 'conversation.get') {
          setHistoryLoadingId(null);
          setConversationsError(text);
          if (message.error?.status === 404 && message.context?.conversationId) {
            const goneId = message.context.conversationId;
            setConversations((prev) => prev.filter((c) => c.id !== goneId));
            if (activeConversationRef.current === goneId) selectConversation(null);
          }
          return;
        }
        if (operation === 'conversation.create' && pendingPrompt.current) {
          pendingPrompt.current = null;
          setBusy(false);
        }
        setConversationsError(text);
        return;
      }

      switch (operation) {
        case 'conversation.list': {
          if (!isSameScope(contextScope, scopeRef.current)) return;
          const list: Conversation[] = Array.isArray(message.data) ? message.data : [];
          setConversations(list);
          setConversationsLoading(false);
          if (!activeConversationRef.current && list.length > 0) {
            selectConversation(list[0].id);
          }
          break;
        }
        case 'conversation.create': {
          const created = message.data as Conversation;
          if (!isSameScope(created.workspaceId, scopeRef.current)) return;
          loadedConversations.current.add(created.id);
          setMessagesByConversation((prev) => ({ ...prev, [created.id]: [] }));
          setConversations((prev) => upsertConversation(prev, created));
          selectConversation(created.id);
          setConversationsError(null);
          const text = pendingPrompt.current;
          pendingPrompt.current = null;
          if (text) dispatchPrompt(created.id, text);
          break;
        }
        case 'conversation.get': {
          const details = message.data as ConversationDetails;
          loadedConversations.current.add(details.id);
          setMessagesByConversation((prev) => ({
            ...prev,
            [details.id]: toChatMessages(details.messages, userRef.current?.id ?? ''),
          }));
          setHistoryLoadingId((current) => (current === details.id ? null : current));
          break;
        }
        case 'conversation.rename': {
          const renamed = message.data as Conversation;
          setConversations((prev) =>
            prev.map((c) => (c.id === renamed.id ? { ...c, title: renamed.title } : c)),
          );
          break;
        }
        case 'conversation.delete': {
          const deletedId = message.data?.conversationId as string;
          loadedConversations.current.delete(deletedId);
          setConversations((prev) => prev.filter((c) => c.id !== deletedId));
          if (activeConversationRef.current === deletedId) {
            if (pending.current?.conversationId === deletedId) cancelPending();
            selectConversation(null);
          }
          break;
        }
      }
    }

    function handleMessage(event: MessageEvent<HostMessage>) {
      const message = event.data;
      if (!message || typeof message.type !== 'string') return;

      if (message.type === 'backend.health.result') {
        setBackendStatus(
          message.ok
            ? `Connected (HTTP ${message.status})`
            : `Connection failed: ${message.text ?? 'Unknown error'}`,
        );
        return;
      }

      if (message.type === 'auth.result') {
        const operation = message.operation;

        if (operation === 'auth.restore') {
          setAuthRestoring(false);
          setUser(message.ok && message.user ? message.user : null);
          return;
        }

        if (operation === 'auth.expired') {
          resetAppState();
          setUser(null);
          setAuthMode('login');
          setAuthError('Your session has expired. Please sign in again.');
          return;
        }

        if (operation === 'auth.login' || operation === 'auth.register') {
          setAuthSubmitting(false);
          if (message.ok && message.user) {
            setUser(message.user);
            setAuthError(null);
          } else {
            setAuthError(
              message.error?.message ||
                (operation === 'auth.login'
                  ? 'Invalid email or password.'
                  : 'Registration failed. Please try again.'),
            );
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

        if (operation === 'auth.me' && message.ok && message.user) {
          setUser(message.user);
        }
        return;
      }

      if (message.type === 'workspace.result') {
        onWorkspaceResult(message);
        return;
      }

      if (message.type === 'conversation.result') {
        onConversationResult(message);
        return;
      }

      if (message.type === 'user.search.result') {
        // Ignore results for anything but the most recent search.
        const latest = latestSearch.current;
        if (!latest || latest.requestId !== message.requestId) return;
        setSearchLoading(false);
        setSearchedQuery(latest.query);
        if (message.ok) {
          setSearchResults(Array.isArray(message.data) ? message.data : []);
        } else {
          setSearchResults([]);
          setNotice({ kind: 'error', text: message.error?.message || 'Failed to search users.' });
        }
        return;
      }

      // Chat task results
      if (
        message.type !== 'assistant.reply' &&
        message.type !== 'task.cancelled' &&
        message.type !== 'task.error'
      ) {
        return;
      }

      if (!pending.current || message.requestId !== pending.current.requestId) return;

      const { conversationId } = pending.current;
      pending.current = null;
      setBusy(false);

      if (message.type === 'assistant.reply') {
        const exchange = message.data as MessageExchange | undefined;
        addMessage(conversationId, {
          id: exchange?.assistantMessage?.id ?? createId(),
          role: 'assistant',
          text: exchange?.assistantMessage?.content ?? message.text ?? 'No response was returned.',
        });
        if (exchange?.conversation && isSameScope(exchange.conversation.workspaceId, scopeRef.current)) {
          setConversations((prev) => upsertConversation(prev, exchange.conversation));
        }
      } else if (message.type === 'task.error') {
        addMessage(conversationId, {
          id: createId(),
          role: 'assistant',
          text: `Something went wrong: ${message.text ?? 'Unknown error'}`,
        });
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
    // Registered once; all mutable values are read through refs.
  }, [selectScope]);

  // ----------------------------------------------------------------- render

  if (authRestoring) {
    return (
      <div className="auth-container">
        <div className="auth-card session-restore-card">
          <div className="auth-brand-icon restore-icon" aria-hidden="true">
            <ShieldCheck size={32} />
          </div>
          <div className="auth-brand-text">
            <h1 className="auth-brand-title">SADS</h1>
            <p className="auth-brand-subtitle">Security-Aware Dependency Selection</p>
          </div>
          <div className="auth-restore-indicator" role="status">
            <div className="loading-dot" />
            <span>Restoring session...</span>
          </div>
        </div>
      </div>
    );
  }

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

  const scopeLabel = activeWorkspace ? `Workspace · ${activeWorkspace.name}` : 'Personal chat';

  return (
    <div className="sads-app">
      <ChatHeader onNewChat={newChat} user={user} onLogout={handleLogout} />

      <WorkspaceSelector
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        activeRole={activeRole}
        loading={workspacesLoading}
        error={workspacesError}
        onSelectWorkspace={(id) => {
          if (id !== activeWorkspaceId) selectScope(id);
        }}
        onOpenManager={(tab) => {
          setNotice(null);
          setWorkspaceModalTab(tab);
          setWorkspaceModalOpen(true);
        }}
      />

      <div className="backend-connection">
        <button type="button" onClick={testBackendConnection}>
          Test Backend Connection
        </button>
        <span role="status">{backendStatus}</span>
      </div>

      <div className="workspace">
        <SessionList
          heading={activeWorkspace ? 'WORKSPACE CHATS' : 'PERSONAL CHATS'}
          sessions={conversations}
          activeSessionId={activeConversationId}
          loading={conversationsLoading || !workspacesReady}
          error={conversationsError}
          disabled={busy}
          canModify={(c) => canModifyConversation(user.id, c, activeRole)}
          onSelect={(id) => {
            if (pending.current) return;
            selectConversation(id);
          }}
          onNewChat={newChat}
          onRename={(conversationId, title) => post('conversation.rename', { conversationId, title })}
          onDelete={(conversationId) => post('conversation.delete', { conversationId })}
          onRetry={() => loadConversations(activeWorkspaceId)}
        />

        <div className="chat-panel">
          <MessageList
            messages={messages}
            busy={busy}
            loadingHistory={historyLoadingId !== null && historyLoadingId === activeConversationId}
            scopeLabel={scopeLabel}
          />
          <PromptComposer busy={busy} onSend={sendPrompt} onCancel={cancelRequest} />
        </div>
      </div>

      <WorkspaceModal
        isOpen={workspaceModalOpen}
        onClose={() => setWorkspaceModalOpen(false)}
        tab={workspaceModalTab}
        onTabChange={setWorkspaceModalTab}
        workspaces={workspaces}
        workspacesLoading={workspacesLoading}
        activeWorkspaceId={activeWorkspaceId}
        activeWorkspaceDetails={activeWorkspaceDetails}
        detailsLoading={detailsLoading}
        currentUserId={user.id}
        loading={mutating}
        onSelectWorkspace={selectScope}
        onCreateWorkspace={handleCreateWorkspace}
        onUpdateWorkspace={handleUpdateWorkspace}
        onDeleteWorkspace={handleDeleteWorkspace}
        onLeaveWorkspace={() => handleRemoveMember(user.id, user.email)}
        onTransferOwnership={handleTransferOwnership}
        onSearchUsers={handleSearchUsers}
        searchResults={searchResults}
        searchLoading={searchLoading}
        searchedQuery={searchedQuery}
        onAddMember={handleAddMember}
        onRemoveMember={handleRemoveMember}
        onUpdateMemberRole={handleUpdateMemberRole}
        detectedPath={detectedPath}
        onRequestDetectPath={() => post('workspace.detectPath')}
        notice={notice}
        onClearNotice={() => setNotice(null)}
      />
    </div>
  );
}
