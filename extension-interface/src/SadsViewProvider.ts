
import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';

import { ApiClient, ApiClientError } from './backend/apiClient';
import { AuthService } from './backend/authService';
import type { ApiEnvelope, AuthUser } from './backend/authTypes';
import { TokenStorage } from './backend/tokenStorage';
import { AgentRun, AgentRunner } from './agent/agentRunner';
import type { ProposedContentProvider } from './agent/workspaceTools';
import type {
  Workspace,
  WorkspaceDetails,
  WorkspaceMember,
  UserSearchResponse,
} from './workspace/workspaceTypes';

interface PromptMessage {
  type: 'chat.prompt';
  requestId: string;
  /** Webview session ID (a draft ID until the conversation is created). */
  sessionId: string;
  workspaceId: string;
  /** Backend conversation ID, or null to start a new conversation. */
  conversationId: string | null;
  text: string;
}

interface ConversationListMessage {
  type: 'conversation.list';
  requestId: string;
  workspaceId: string;
}

interface ConversationGetMessage {
  type: 'conversation.get';
  requestId: string;
  conversationId: string;
}

interface ConversationDeleteMessage {
  type: 'conversation.delete';
  requestId: string;
  conversationId: string;
}

type ConversationMessage =
  | ConversationListMessage
  | ConversationGetMessage
  | ConversationDeleteMessage;

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

interface WorkspaceListMessage {
  type: 'workspace.list';
  requestId: string;
}

interface WorkspaceGetMessage {
  type: 'workspace.get';
  requestId: string;
  workspaceId: string;
}

interface WorkspaceCreateMessage {
  type: 'workspace.create';
  requestId: string;
  name: string;
  rootPath: string;
}

interface WorkspaceUpdateMessage {
  type: 'workspace.update';
  requestId: string;
  workspaceId: string;
  name?: string;
  rootPath?: string;
}

interface WorkspaceDeleteMessage {
  type: 'workspace.delete';
  requestId: string;
  workspaceId: string;
}

interface WorkspaceAddMemberMessage {
  type: 'workspace.member.add';
  requestId: string;
  workspaceId: string;
  userId: string;
  role: 'ADMIN' | 'DEVELOPER' | 'VIEWER';
}

interface WorkspaceRemoveMemberMessage {
  type: 'workspace.member.remove';
  requestId: string;
  workspaceId: string;
  userId: string;
}

interface WorkspaceUpdateRoleMessage {
  type: 'workspace.member.updateRole';
  requestId: string;
  workspaceId: string;
  userId: string;
  role: 'ADMIN' | 'DEVELOPER' | 'VIEWER';
}

interface WorkspaceDetectPathMessage {
  type: 'workspace.detectPath';
  requestId: string;
}

interface UserSearchMessage {
  type: 'user.search';
  requestId: string;
  query: string;
  workspaceId?: string;
  page?: number;
  limit?: number;
}

type WorkspaceMessage =
  | WorkspaceListMessage
  | WorkspaceGetMessage
  | WorkspaceCreateMessage
  | WorkspaceUpdateMessage
  | WorkspaceDeleteMessage
  | WorkspaceAddMemberMessage
  | WorkspaceRemoveMemberMessage
  | WorkspaceUpdateRoleMessage
  | WorkspaceDetectPathMessage;

type WebviewMessage =
  | PromptMessage
  | ConversationMessage
  | CancelMessage
  | BackendHealthMessage
  | AuthMessage
  | WorkspaceMessage
  | UserSearchMessage;

export class SadsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'sads.chatView';

  private readonly apiClient: ApiClient;
  private readonly authService: AuthService;
  private readonly agentRunner: AgentRunner;
  /** Agent runs in progress, keyed by the webview's request ID. */
  private readonly runs = new Map<string, AgentRun>();

  constructor(
    private readonly extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
    proposals: ProposedContentProvider,
    output: vscode.OutputChannel,
  ) {
    this.apiClient = new ApiClient(() =>
      vscode.workspace
        .getConfiguration('sads')
        .get<string>('backendUrl', 'http://localhost:5000'),
    );

    this.authService = new AuthService(
      this.apiClient,
      new TokenStorage(context.secrets),
    );

    this.agentRunner = new AgentRunner(
      this.apiClient,
      this.authService,
      proposals,
      output,
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
      for (const run of this.runs.values()) {run.cancel();}
      this.runs.clear();
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

    webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
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
                'http://localhost:5000',
              );

            const baseUrl = configuredUrl.replace(/\/+$/, '');

            const response = await fetch(
              `${baseUrl}/api/v1/health`,
              { signal: AbortSignal.timeout(5000) },
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
        if (
          message.type === 'workspace.list' ||
          message.type === 'workspace.get' ||
          message.type === 'workspace.create' ||
          message.type === 'workspace.update' ||
          message.type === 'workspace.delete' ||
          message.type === 'workspace.member.add' ||
          message.type === 'workspace.member.remove' ||
          message.type === 'workspace.member.updateRole' ||
          message.type === 'workspace.detectPath'
        ) {
          await this.handleWorkspaceMessage(webview, message);
          return;
        }

        // 4. User search operations
        if (message.type === 'user.search') {
          await this.handleUserSearchMessage(webview, message);
          return;
        }

        // 5. Conversation history
        if (
          message.type === 'conversation.list' ||
          message.type === 'conversation.get' ||
          message.type === 'conversation.delete'
        ) {
          await this.handleConversationMessage(webview, message);
          return;
        }

        // 6. Cancel a running agent task
        if (
          message.type === 'task.cancel' &&
          typeof message.requestId === 'string'
        ) {
          this.runs.get(message.requestId)?.cancel();
          return;
        }

        // 7. Prompts for the coding agent
        if (
          message.type === 'chat.prompt' &&
          typeof message.text === 'string' &&
          typeof message.requestId === 'string' &&
          typeof message.workspaceId === 'string'
        ) {
          await this.handlePrompt(webview, message);
        }
      },
    );
  }

  private async handlePrompt(
    webview: vscode.Webview,
    message: PromptMessage,
  ): Promise<void> {
    const { requestId, sessionId } = message;
    const run = new AgentRun();
    this.runs.set(requestId, run);

    try {
      const outcome = await this.agentRunner.run(run, {
        workspaceId: message.workspaceId,
        conversationId: message.conversationId,
        text: message.text,
        clientRequestId: requestId,
        callbacks: {
          onConversationCreated: (conversation) => {
            void webview.postMessage({
              type: 'agent.conversation',
              requestId,
              sessionId,
              conversation,
            });
          },
          onMessages: (messages) => {
            void webview.postMessage({ type: 'agent.messages', requestId, messages });
          },
          onActivity: (text) => {
            void webview.postMessage({ type: 'agent.activity', requestId, text });
          },
        },
      });

      await webview.postMessage({
        type: 'agent.done',
        requestId,
        status: outcome.status,
        conversationId: outcome.conversationId,
        error: outcome.error,
      });
    } finally {
      this.runs.delete(requestId);
    }
  }

  private async handleConversationMessage(
    webview: vscode.Webview,
    message: ConversationMessage,
  ): Promise<void> {
    try {
      let data: unknown = null;

      switch (message.type) {
        case 'conversation.list':
          data = await this.agentRunner.listConversations(message.workspaceId);
          break;
        case 'conversation.get':
          data = await this.agentRunner.getConversation(message.conversationId);
          break;
        case 'conversation.delete':
          await this.agentRunner.deleteConversation(message.conversationId);
          data = { conversationId: message.conversationId };
          break;
      }

      await webview.postMessage({
        type: 'conversation.result',
        operation: message.type,
        requestId: message.requestId,
        ok: true,
        data,
        ...(message.type === 'conversation.list'
          ? { workspaceId: message.workspaceId }
          : { conversationId: message.conversationId }),
      });
    } catch (error: unknown) {
      const isApiError = error instanceof ApiClientError;

      await webview.postMessage({
        type: 'conversation.result',
        operation: message.type,
        requestId: message.requestId,
        ok: false,
        error: {
          code: isApiError ? error.code : 'CONVERSATION_ERROR',
          status: isApiError ? error.status : 0,
          message:
            error instanceof Error
              ? error.message
              : 'Conversation request failed.',
        },
      });
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
          const res = await this.apiClient.get<ApiEnvelope<Workspace[]>>(
            '/workspaces',
          );
          data = res.data;
          break;
        }

        case 'workspace.get': {
          const res = await this.apiClient.get<ApiEnvelope<WorkspaceDetails>>(
            `/workspaces/${message.workspaceId}`,
          );
          data = res.data;
          break;
        }

        case 'workspace.create': {
          const res = await this.apiClient.post<ApiEnvelope<Workspace>>(
            '/workspaces',
            {
              name: message.name,
              rootPath: message.rootPath,
            },
          );
          data = res.data;
          break;
        }

        case 'workspace.update': {
          const res = await this.apiClient.patch<ApiEnvelope<Workspace>>(
            `/workspaces/${message.workspaceId}`,
            {
              name: message.name,
              rootPath: message.rootPath,
            },
          );
          data = res.data;
          break;
        }

        case 'workspace.delete': {
          await this.apiClient.delete(`/workspaces/${message.workspaceId}`);
          data = { workspaceId: message.workspaceId };
          break;
        }

        case 'workspace.member.add': {
          const res = await this.apiClient.post<ApiEnvelope<WorkspaceMember>>(
            `/workspaces/${message.workspaceId}/members`,
            {
              userId: message.userId,
              role: message.role,
            },
          );
          data = res.data;
          break;
        }

        case 'workspace.member.remove': {
          await this.apiClient.delete(
            `/workspaces/${message.workspaceId}/members/${message.userId}`,
          );
          data = {
            workspaceId: message.workspaceId,
            userId: message.userId,
          };
          break;
        }

        case 'workspace.member.updateRole': {
          const res = await this.apiClient.patch<ApiEnvelope<WorkspaceMember>>(
            `/workspaces/${message.workspaceId}/members/${message.userId}`,
            {
              role: message.role,
            },
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
      const isApiError = error instanceof ApiClientError;

      await webview.postMessage({
        type: 'workspace.result',
        operation: message.type,
        requestId: message.requestId,
        ok: false,
        error: {
          code: isApiError ? error.code : 'WORKSPACE_ERROR',
          status: isApiError ? error.status : 0,
          message:
            error instanceof Error
              ? error.message
              : 'Workspace operation failed.',
        },
      });
    }
  }

  private async handleUserSearchMessage(
    webview: vscode.Webview,
    message: UserSearchMessage,
  ): Promise<void> {
    try {
      const queryParams = new URLSearchParams({
        q: message.query,
        page: String(message.page ?? 1),
        limit: String(message.limit ?? 10),
      });

      if (message.workspaceId) {
        queryParams.set('workspaceId', message.workspaceId);
      }

      const res = await this.apiClient.get<UserSearchResponse>(
        `/users/search?${queryParams.toString()}`,
      );

      await webview.postMessage({
        type: 'user.search.result',
        requestId: message.requestId,
        ok: true,
        data: res.data,
        pagination: res.pagination,
      });
    } catch (error: unknown) {
      const isApiError = error instanceof ApiClientError;

      await webview.postMessage({
        type: 'user.search.result',
        requestId: message.requestId,
        ok: false,
        error: {
          code: isApiError ? error.code : 'SEARCH_ERROR',
          status: isApiError ? error.status : 0,
          message:
            error instanceof Error
              ? error.message
              : 'Failed to search users.',
        },
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
