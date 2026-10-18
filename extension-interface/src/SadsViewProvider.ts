
import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

interface PromptMessage {
  type: 'chat.prompt';
  requestId: string;
  sessionId: string;
  text: string;
}

interface CancelMessage {
  type: 'task.cancel';
  requestId: string;
}

type WebviewMessage = PromptMessage | CancelMessage;

export class SadsViewProvider
  implements vscode.WebviewViewProvider {

  public static readonly viewType = 'sads.chatView';

  constructor(
    private readonly extensionUri: vscode.Uri,
  ) {}

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
        if (
          !message ||
          typeof message !== 'object' ||
          !('type' in message)
        ) {
          return;
        }

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

        if (
          message.type !== 'chat.prompt' ||
          typeof message.text !== 'string' ||
          typeof message.requestId !== 'string' ||
          typeof message.sessionId !== 'string'
        ) {
          return;
        }

        const { requestId, text } = message;

        // Mock response for Phase 2.
        // The backend and AI agent will replace this later.
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (cancelled.delete(requestId)) {
          return;
        }

        await webview.postMessage({
          type: 'assistant.reply',
          requestId,
          text:
            `I received your request:\n\n"${text}"\n\n` +
            'The React chat UI is connected to the SADS extension host. ' +
            'The backend and AI agent will be integrated in a later phase.',
        });
      },
    );
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
      (_match, prefix: string, assetPath: string, suffix: string) => {
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
