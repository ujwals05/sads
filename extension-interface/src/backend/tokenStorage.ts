
import type * as vscode from "vscode";

const REFRESH_TOKEN_KEY = "sads.auth.refreshToken";

export class TokenStorage {
  constructor(
    private readonly secrets: vscode.SecretStorage,
  ) {}

  async getRefreshToken(): Promise<string | undefined> {
    return this.secrets.get(REFRESH_TOKEN_KEY);
  }

  async setRefreshToken(token: string): Promise<void> {
    await this.secrets.store(REFRESH_TOKEN_KEY, token);
  }

  async clearRefreshToken(): Promise<void> {
    await this.secrets.delete(REFRESH_TOKEN_KEY);
  }
}
