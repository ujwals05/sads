interface SadsVsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

interface Window {
  acquireVsCodeApi(): SadsVsCodeApi;
}
