
import * as vscode from 'vscode';
import { SadsViewProvider } from './SadsViewProvider';
import { ProposedContentProvider } from './agent/workspaceTools';

export function activate(
  context: vscode.ExtensionContext,
): void {
  
  const output = vscode.window.createOutputChannel('SADS Agent');
  const proposals = new ProposedContentProvider();

  context.subscriptions.push(
    output,
    vscode.workspace.registerTextDocumentContentProvider(
      ProposedContentProvider.scheme,
      proposals,
    ),
  );

  const provider = new SadsViewProvider(
    context.extensionUri,
    context,
    proposals,
    output,
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SadsViewProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'sads-agent.helloWorld',
      () => {
        void vscode.window.showInformationMessage(
          'SADS extension is ready.',
        );
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'sads-agent.openChat',
      async () => {
        await vscode.commands.executeCommand(
          'workbench.view.extension.sads',
        );
      },
    ),
  );

  console.log('SADS extension activated');
}

export function deactivate(): void {}
