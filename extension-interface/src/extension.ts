
import * as vscode from 'vscode';
import { SadsViewProvider } from './SadsViewProvider';

export function activate(
  context: vscode.ExtensionContext,
): void {
  const provider = new SadsViewProvider(context.extensionUri);

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
