/** Shared handle to the VS Code webview API (with a browser fallback for `vite dev`). */
export const vscode: SadsVsCodeApi =
  typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function'
    ? window.acquireVsCodeApi()
    : {
        postMessage: (message: unknown) => {
          console.log('[SADS webview mock vscode.postMessage]:', message);
        },
        getState: () => ({}),
        setState: () => {},
      };

export function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface PersistedState {
  // undefined = never chosen; null = personal chats; string = workspace id.
  workspaceId?: string | null;
}

export function readPersistedState(): PersistedState {
  try {
    const state = vscode.getState();
    return state && typeof state === 'object' ? (state as PersistedState) : {};
  } catch {
    return {};
  }
}

export function persistState(patch: PersistedState): void {
  try {
    vscode.setState({ ...readPersistedState(), ...patch });
  } catch {
    // Webview state is a convenience only.
  }
}
