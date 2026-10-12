
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    const provider = new SadsViewProvider();

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            SadsViewProvider.viewType,
            provider
        )
    );

    console.log('SADS extension activated');
}

class SadsViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'sads.chatView';

    resolveWebviewView(webviewView: vscode.WebviewView) {
        const webview = webviewView.webview;

        webview.options = {
            enableScripts: true
        };

        webview.html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport"
                      content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        padding: 12px;
                        color: var(--vscode-foreground);
                        font-family: var(--vscode-font-family);
                    }

                    h2 {
                        margin-top: 0;
                    }

                    textarea {
                        box-sizing: border-box;
                        width: 100%;
                        min-height: 75px;
                        padding: 8px;
                        color: var(--vscode-input-foreground);
                        background: var(--vscode-input-background);
                        border: 1px solid var(--vscode-input-border);
                    }

                    button {
                        margin-top: 8px;
                        padding: 7px 12px;
                        width: 100%;
                        cursor: pointer;
                    }

                    #messages {
                        margin-top: 16px;
                        overflow-wrap: anywhere;
                    }
                </style>
            </head>
            <body>
                <h2>SADS Assistant</h2>
                <p>Security-aware coding assistant</p>

                <form id="form">
                    <textarea id="prompt"
                        placeholder="What would you like to build?"
                        required></textarea>
                    <button type="submit">Send</button>
                </form>

                <div id="messages" aria-live="polite"></div>

                <script>
                    const vscode = acquireVsCodeApi();
                    const form = document.getElementById('form');
                    const prompt = document.getElementById('prompt');
                    const messages = document.getElementById('messages');

                    form.addEventListener('submit', (event) => {
                        event.preventDefault();

                        const text = prompt.value.trim();
                        if (!text) return;

                        const userMessage = document.createElement('p');
                        userMessage.textContent = 'You: ' + text;
                        messages.appendChild(userMessage);

                        vscode.postMessage({
                            type: 'prompt',
                            text: text
                        });

                        prompt.value = '';
                    });

                    window.addEventListener('message', (event) => {
                        const message = event.data;

                        const reply = document.createElement('p');
                        reply.textContent = 'SADS: ' + message.text;
                        messages.appendChild(reply);
                    });
                </script>
            </body>
            </html>
        `;

        webview.onDidReceiveMessage(async (message) => {
            if (message.type !== 'prompt' ||
                typeof message.text !== 'string') {
                return;
            }

            webview.postMessage({
                text: 'Message received! AI responses and dependency security checks will be connected next.'
            });
        });
    }
}

export function deactivate() {}
