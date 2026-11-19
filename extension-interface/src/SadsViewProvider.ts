
import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';

import { ApiClient, ApiClientError } from './backend/apiClient';
import { AuthService } from './backend/authService';
import type { ApiEnvelope, AuthUser } from './backend/authTypes';
import { TokenStorage } from './backend/tokenStorage';
import type {
  AssignableRole,
  Conversation,
  ConversationDetails,
  MessageExchange,
  Workspace,
  WorkspaceDetails,
  WorkspaceMember,
  UserSearchResponse,
} from './workspace/workspaceTypes';

interface PromptMessage {
  type: 'chat.prompt';
  requestId: string;
  conversationId: string;
  text: string;
}

interface CancelMessage {
  type: 'task.cancel';
  requestId: string;
}

interface BackendHealthMessage {
  type: 'backend.health';
  requestId: string;
}

interface AuthLoginMessage {
  type: 'auth.login';
  requestId: string;
  email: string;
  password: string;
}

interface AuthRegisterMessage {
  type: 'auth.register';
  requestId: string;
  email: string;
  password: string;
}

interface AuthRestoreMessage {
  type: 'auth.restore';
  requestId: string;
}

interface AuthLogoutMessage {
  type: 'auth.logout';
  requestId: string;
}

interface AuthMeMessage {
  type: 'auth.me';
  requestId: string;
}

type AuthMessage =
  | AuthLoginMessage
  | AuthRegisterMessage
  | AuthRestoreMessage
  | AuthLogoutMessage
  | AuthMeMessage;

type WorkspaceMessage =
  | { type: 'workspace.list'; requestId: string }
  | { type: 'workspace.get'; requestId: string; workspaceId: string }
  | {
      type: 'workspace.create';
      requestId: string;
      name: string;
      description?: string | null;
      rootPath?: string | null;
    }
  | {
      type: 'workspace.update';
      requestId: string;
      workspaceId: string;
      name?: string;
      description?: string | null;
      rootPath?: string | null;
    }
  | { type: 'workspace.delete'; requestId: string; workspaceId: string }
  | {
      type: 'workspace.member.add';
      requestId: string;
      workspaceId: string;
      userId: string;
      role: AssignableRole;
    }
  | {
      type: 'workspace.member.remove';
      requestId: string;
      workspaceId: string;
      userId: string;
    }
  | {
      type: 'workspace.member.updateRole';
      requestId: string;
      workspaceId: string;
      userId: string;
      role: AssignableRole;
    }
  | {
      type: 'workspace.transferOwnership';
      requestId: string;
      workspaceId: string;
      userId: string;
    }
  | { type: 'workspace.detectPath'; requestId: string };

interface UserSearchMessage {
  type: 'user.search';
  requestId: string;
  query: string;
  workspaceId?: string;
  page?: number;
  limit?: number;
}

type ConversationMessage =
  | { type: 'conversation.list'; requestId: string; workspaceId: string | null }
  | { type: 'conversation.create'; requestId: string; workspaceId: string | null }
  | { type: 'conversation.get'; requestId: string; conversationId: string }
  | {
      type: 'conversation.rename';
      requestId: string;
      conversationId: string;
      title: string;
    }
  | { type: 'conversation.delete'; requestId: string; conversationId: string };

type WebviewMessage =
  | PromptMessage
  | CancelMessage
  | BackendHealthMessage
  | AuthMessage
  | WorkspaceMessage
  | ConversationMessage
  | UserSearchMessage;

const WORKSPACE_TYPES = new Set<string>([
  'workspace.list',
  'workspace.get',
  'workspace.create',
  'workspace.update',
  'workspace.delete',
  'workspace.member.add',
  'workspace.member.remove',
  'workspace.member.updateRole',
  'workspace.transferOwnership',
  'workspace.detectPath',
]);

const CONVERSATION_TYPES = new Set<string>([
  'conversation.list',
  'conversation.create',
  'conversation.get',
  'conversation.rename',
  'conversation.delete',
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * IDs from the webview are interpolated into URL paths, so only well-formed
 * UUIDs are accepted. The backend still performs the real authorization.
 */
function requireId(value: unknown, label: string): string {
  if (typeof value === 'string' && UUID_PATTERN.test(value)) {
    return value;
  }
  throw new ApiClientError(`Invalid ${label}.`, 0, 'INVALID_ID');
}

function optionalId(value: unknown, label: string): string | null {
  return value === null || value === undefined || value === ''
    ? null
    : requireId(value, label);
}

function toErrorPayload(error: unknown, fallbackCode: string, fallbackMessage: string) {
  const isApiError = error instanceof ApiClientError;
  return {
    code: isApiError ? error.code ?? fallbackCode : fallbackCode,
    status: isApiError ? error.status : 0,
    message: error instanceof Error ? error.message : fallbackMessage,
  };
}

export class SadsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'sads.chatView';

  private readonly apiClient: ApiClient;
  private readonly authService: AuthService;

  constructor(
    private readonly extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
  ) {
    this.apiClient = new ApiClient(() =>
      vscode.workspace
        .getConfiguration('sads')
        .get<string>('backendUrl', 'http://localhost:5001'),
    );

    this.authService = new AuthService(
      this.apiClient,
      new TokenStorage(context.secrets),
    );
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
  ): void {
    const webview = webviewView.webview;

    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(
          this.extensionUri,
          'media',
          'webview-ui',
        ),
      ],
    };

    webviewView.onDidDispose(() => {
      // No persistent resources are created in this starter.
    });

    void this.loadHtml(webview).then(
      (html) => {
        webview.html = html;
      },
      (error: unknown) => {
        console.error('SADS webview failed to load:', error);

        webview.html = `
          <!doctype html>
          <html>
            <body>
              <h3>SADS UI could not be loaded</h3>
              <p>Build the React frontend and reload the extension.</p>
            </body>
          </html>
        `;
      },
    );

    const cancelled = new Set<string>();

    webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        if (!message || typeof message.type !== 'string') {
          return;
        }

        // 1. Backend health check
        if (
          message.type === 'backend.health' &&
          typeof message.requestId === 'string'
        ) {
          const requestId = message.requestId;

          try {
            const configuredUrl = vscode.workspace
              .getConfiguration('sads')
              .get<string>(
                'backendUrl',
                'http://localhost:5001',
              );

            const baseUrl = configuredUrl.replace(/\/+$/, '');

            const response = await fetch(
              `${baseUrl}/api/v1/health`,
              { signal: AbortSignal.timeout(5001) },
            );

            const responseText = await response.text();

            await webview.postMessage({
              type: 'backend.health.result',
              requestId,
              ok: response.ok,
              status: response.status,
              text: responseText.slice(0, 2000),
            });
          } catch (error: unknown) {
            await webview.postMessage({
              type: 'backend.health.result',
              requestId,
              ok: false,
              text:
                error instanceof Error
                  ? error.message
                  : 'Unable to connect to the backend.',
            });
          }

          return;
        }

        // 2. Authentication operations
        if (
          message.type === 'auth.login' ||
          message.type === 'auth.register' ||
          message.type === 'auth.restore' ||
          message.type === 'auth.logout' ||
          message.type === 'auth.me'
        ) {
          await this.handleAuthMessage(webview, message);
          return;
        }

        // 3. Workspace operations
        if (WORKSPACE_TYPES.has(message.type)) {
          await this.handleWorkspaceMessage(webview, message as WorkspaceMessage);
          return;
        }

        // 4. Conversation (chat session) operations
        if (CONVERSATION_TYPES.has(message.type)) {
          await this.handleConversationMessage(
            webview,
            message as ConversationMessage,
          );
          return;
        }

        // 5. User search operations
        if (message.type === 'user.search') {
          await this.handleUserSearchMessage(webview, message);
          return;
        }

        // 6. Cancel a chat task
        if (
          message.type === 'task.cancel' &&
          typeof message.requestId === 'string'
        ) {
          cancelled.add(message.requestId);

          await webview.postMessage({
            type: 'task.cancelled',
            requestId: message.requestId,
          });

          return;
        }

        // 7. Chat prompts: persisted through the backend.
        if (
          message.type !== 'chat.prompt' ||
          typeof message.text !== 'string' ||
          typeof message.requestId !== 'string'
        ) {
          return;
        }

        const { requestId, text } = message;

        try {
          const conversationId = requireId(message.conversationId, 'conversation ID');

          const res = await this.withAuth(webview, () =>
            this.apiClient.post<ApiEnvelope<MessageExchange>>(
              `/conversations/${conversationId}/messages`,
              { content: text, clientRequestId: requestId },
              { signal: AbortSignal.timeout(60_000) },
            ),
          );

          // A cancelled request is still saved server-side; the UI simply
          // ignores the reply and will see it when the chat is reloaded.
          if (cancelled.delete(requestId)) {
            return;
          }

          await webview.postMessage({
            type: 'assistant.reply',
            requestId,
            text: res.data.assistantMessage?.content ?? '',
            data: res.data,
          });
        } catch (error: unknown) {
          if (cancelled.delete(requestId)) {
            return;
          }

          await webview.postMessage({
            type: 'task.error',
            requestId,
            text:
              error instanceof Error
                ? error.message
                : 'The message could not be sent.',
          });
        }
      },
    );
  }

  /**
   * Run an authenticated API call. If the short-lived access token has
   * expired, refresh the session once and retry; if the refresh token is no
   * longer valid either, tell the webview the session ended.
   */
  private async withAuth<T>(
    webview: vscode.Webview,
    call: () => Promise<T>,
  ): Promise<T> {
    try {
      return await call();
    } catch (error: unknown) {
      if (
        !(error instanceof ApiClientError) ||
        error.status !== 401 ||
        this.authService.getState().status !== 'authenticated'
      ) {
        throw error;
      }

      const user = await this.authService.restoreSession();

      if (!user) {
        await webview.postMessage({
          type: 'auth.result',
          operation: 'auth.expired',
          requestId: '',
          ok: true,
          user: null,
        });
        throw error;
      }

      return call();
    }
  }

  private async handleAuthMessage(
    webview: vscode.Webview,
    message: AuthMessage,
  ): Promise<void> {
    try {
      let user: AuthUser | null = null;

      switch (message.type) {
        case 'auth.login': {
          user = await this.authService.login(
            message.email,
            message.password,
          );
          break;
        }

        case 'auth.register': {
          user = await this.authService.register(
            message.email,
            message.password,
          );
          break;
        }

        case 'auth.restore': {
          user = await this.authService.restoreSession();
          break;
        }

        case 'auth.logout': {
          await this.authService.logout();
          user = null;
          break;
        }

        case 'auth.me': {
          user = await this.authService.getCurrentUser();
          break;
        }
      }

      await webview.postMessage({
        type: 'auth.result',
        operation: message.type,
        requestId: message.requestId,
        ok: true,
        user,
      });
    } catch (error: unknown) {
      const isApiError = error instanceof ApiClientError;

      await webview.postMessage({
        type: 'auth.result',
        operation: message.type,
        requestId: message.requestId,
        ok: false,
        error: {
          code: isApiError ? error.code : 'AUTH_ERROR',
          status: isApiError ? error.status : 0,
          message:
            error instanceof Error
              ? error.message
              : 'Authentication failed. Please try again.',
        },
      });
    }
  }


  private async handleWorkspaceMessage(
    webview: vscode.Webview,
    message: WorkspaceMessage,
  ): Promise<void> {
    try {
      let data: unknown = null;

      switch (message.type) {
        case 'workspace.detectPath': {
          const detectedPath =
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
          data = { path: detectedPath };
          break;
        }

        case 'workspace.list': {
          const res = await this.withAuth(webview, () =>
            this.apiClient.get<ApiEnvelope<Workspace[]>>('/workspaces'),
          );
          data = res.data;
          break;
        }

        case 'workspace.get': {
          const workspaceId = requireId(message.workspaceId, 'workspace ID');
          const res = await this.withAuth(webview, () =>
            this.apiClient.get<ApiEnvelope<WorkspaceDetails>>(
              `/workspaces/${workspaceId}`,
            ),
          );
          data = res.data;
          break;
        }

        case 'workspace.create': {
          const res = await this.withAuth(webview, () =>
            this.apiClient.post<ApiEnvelope<Workspace>>('/workspaces', {
              name: message.name,
              description: message.description ?? null,
              rootPath: message.rootPath ?? null,
            }),
          );
          data = res.data;
          break;
        }

        case 'workspace.update': {
          const workspaceId = requireId(message.workspaceId, 'workspace ID');
          const res = await this.withAuth(webview, () =>
            this.apiClient.patch<ApiEnvelope<Workspace>>(
              `/workspaces/${workspaceId}`,
              {
                name: message.name,
                description: message.description,
                rootPath: message.rootPath,
              },
            ),
          );
          data = res.data;
          break;
        }

        case 'workspace.delete': {
          const workspaceId = requireId(message.workspaceId, 'workspace ID');
          await this.withAuth(webview, () =>
            this.apiClient.delete(`/workspaces/${workspaceId}`),
          );
          data = { workspaceId };
          break;
        }

        case 'workspace.member.add': {
          const workspaceId = requireId(message.workspaceId, 'workspace ID');
          const userId = requireId(message.userId, 'user ID');
          const res = await this.withAuth(webview, () =>
            this.apiClient.post<ApiEnvelope<WorkspaceMember>>(
              `/workspaces/${workspaceId}/members`,
              { userId, role: message.role },
            ),
          );
          data = res.data;
          break;
        }

        case 'workspace.member.remove': {
          const workspaceId = requireId(message.workspaceId, 'workspace ID');
          const userId = requireId(message.userId, 'user ID');
          await this.withAuth(webview, () =>
            this.apiClient.delete(`/workspaces/${workspaceId}/members/${userId}`),
          );
          data = { workspaceId, userId };
          break;
        }

        case 'workspace.member.updateRole': {
          const workspaceId = requireId(message.workspaceId, 'workspace ID');
          const userId = requireId(message.userId, 'user ID');
          const res = await this.withAuth(webview, () =>
            this.apiClient.patch<ApiEnvelope<WorkspaceMember>>(
              `/workspaces/${workspaceId}/members/${userId}`,
              { role: message.role },
            ),
          );
          data = res.data;
          break;
        }

        case 'workspace.transferOwnership': {
          const workspaceId = requireId(message.workspaceId, 'workspace ID');
          const userId = requireId(message.userId, 'user ID');
          const res = await this.withAuth(webview, () =>
            this.apiClient.post<ApiEnvelope<WorkspaceMember[]>>(
              `/workspaces/${workspaceId}/transfer-ownership`,
              { userId },
            ),
          );
          data = res.data;
          break;
        }
      }

      await webview.postMessage({
        type: 'workspace.result',
        operation: message.type,
        requestId: message.requestId,
        ok: true,
        data,
      });
    } catch (error: unknown) {
      await webview.postMessage({
        type: 'workspace.result',
        operation: message.type,
        requestId: message.requestId,
        ok: false,
        error: toErrorPayload(error, 'WORKSPACE_ERROR', 'Workspace operation failed.'),
      });
    }
  }

  private async handleConversationMessage(
    webview: vscode.Webview,
    message: ConversationMessage,
  ): Promise<void> {
    // Echo the scope back so the webview can ignore stale responses (e.g. a
    // conversation list that arrives after the user switched workspace).
    const context = {
      workspaceId: 'workspaceId' in message ? message.workspaceId ?? null : undefined,
      conversationId: 'conversationId' in message ? message.conversationId : undefined,
    };

    try {
      let data: unknown = null;

      switch (message.type) {
        case 'conversation.list': {
          const workspaceId = optionalId(message.workspaceId, 'workspace ID');
          const query = workspaceId ? `?workspaceId=${workspaceId}` : '';
          const res = await this.withAuth(webview, () =>
            this.apiClient.get<ApiEnvelope<Conversation[]>>(`/conversations${query}`),
          );
          data = res.data;
          break;
        }

        case 'conversation.create': {
          const workspaceId = optionalId(message.workspaceId, 'workspace ID');
          const res = await this.withAuth(webview, () =>
            this.apiClient.post<ApiEnvelope<Conversation>>('/conversations', {
              workspaceId,
            }),
          );
          data = res.data;
          break;
        }

        case 'conversation.get': {
          const conversationId = requireId(message.conversationId, 'conversation ID');
          const res = await this.withAuth(webview, () =>
            this.apiClient.get<ApiEnvelope<ConversationDetails>>(
              `/conversations/${conversationId}`,
            ),
          );
          data = res.data;
          break;
        }

        case 'conversation.rename': {
          const conversationId = requireId(message.conversationId, 'conversation ID');
          const res = await this.withAuth(webview, () =>
            this.apiClient.patch<ApiEnvelope<Conversation>>(
              `/conversations/${conversationId}`,
              { title: message.title },
            ),
          );
          data = res.data;
          break;
        }

        case 'conversation.delete': {
          const conversationId = requireId(message.conversationId, 'conversation ID');
          await this.withAuth(webview, () =>
            this.apiClient.delete(`/conversations/${conversationId}`),
          );
          data = { conversationId };
          break;
        }
      }

      await webview.postMessage({
        type: 'conversation.result',
        operation: message.type,
        requestId: message.requestId,
        ok: true,
        context,
        data,
      });
    } catch (error: unknown) {
      await webview.postMessage({
        type: 'conversation.result',
        operation: message.type,
        requestId: message.requestId,
        ok: false,
        context,
        error: toErrorPayload(error, 'CONVERSATION_ERROR', 'Conversation operation failed.'),
      });
    }
  }

  private async handleUserSearchMessage(
    webview: vscode.Webview,
    message: UserSearchMessage,
  ): Promise<void> {
    try {
      const queryParams = new URLSearchParams({
        q: String(message.query ?? ''),
        page: String(message.page ?? 1),
        limit: String(message.limit ?? 10),
      });

      if (message.workspaceId) {
        queryParams.set('workspaceId', requireId(message.workspaceId, 'workspace ID'));
      }

      const res = await this.withAuth(webview, () =>
        this.apiClient.get<UserSearchResponse>(
          `/users/search?${queryParams.toString()}`,
        ),
      );

      await webview.postMessage({
        type: 'user.search.result',
        requestId: message.requestId,
        ok: true,
        data: res.data,
        pagination: res.pagination,
      });
    } catch (error: unknown) {
      await webview.postMessage({
        type: 'user.search.result',
        requestId: message.requestId,
        ok: false,
        error: toErrorPayload(error, 'SEARCH_ERROR', 'Failed to search users.'),
      });
    }
  }

  private async loadHtml(
    webview: vscode.Webview,
  ): Promise<string> {
    const outputDir = vscode.Uri.joinPath(
      this.extensionUri,
      'media',
      'webview-ui',
    );

    const indexUri = vscode.Uri.joinPath(
      outputDir,
      'index.html',
    );

    let html = await fs.readFile(indexUri.fsPath, 'utf8');

    const assetPattern =
      /((?:src|href)=["'])\.\/(assets\/[^"']+)(["'])/g;

    html = html.replace(
      assetPattern,
      (
        _match,
        prefix: string,
        assetPath: string,
        suffix: string,
      ) => {
        const assetUri = vscode.Uri.joinPath(
          outputDir,
          ...assetPath.split('/'),
        );

        return `${prefix}${webview.asWebviewUri(assetUri)}${suffix}`;
      },
    );

    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src ${webview.cspSource}`,
      `font-src ${webview.cspSource}`,
    ].join('; ');

    html = html.replace(
      '<head>',
      `<head><meta http-equiv="Content-Security-Policy" content="${csp}">`,
    );

    return html;
  }
}
