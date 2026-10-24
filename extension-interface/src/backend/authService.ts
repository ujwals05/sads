
import type { ApiClient } from "./apiClient";
import { ApiClientError } from "./apiClient";
import type {
  ApiEnvelope,
  AuthResult,
  AuthState,
  AuthTokens,
  AuthUser,
} from "./authTypes";
import { TokenStorage } from "./tokenStorage";

export class AuthService {
  private user: AuthUser | null = null;
  private refreshInFlight: Promise<AuthUser | null> | null = null;

  constructor(
    private readonly api: ApiClient,
    private readonly tokenStorage: TokenStorage,
  ) {}

  getState(): AuthState {
    return {
      status: this.user ? "authenticated" : "unauthenticated",
      user: this.user,
    };
  }

  async register(
    email: string,
    password: string,
  ): Promise<AuthUser> {
    const result = await this.api.post<ApiEnvelope<AuthResult>>(
      "/auth/register",
      { email, password },
    );

    return this.acceptAuthResult(result.data);
  }

  async login(
    email: string,
    password: string,
  ): Promise<AuthUser> {
    const result = await this.api.post<ApiEnvelope<AuthResult>>(
      "/auth/login",
      { email, password },
    );

    return this.acceptAuthResult(result.data);
  }

  async restoreSession(): Promise<AuthUser | null> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.restoreSessionInternal();

    try {
      return await this.refreshInFlight;
    } finally {
      this.refreshInFlight = null;
    }
  }

  private async restoreSessionInternal(): Promise<AuthUser | null> {
    const refreshToken = await this.tokenStorage.getRefreshToken();

    if (!refreshToken) {
      this.clearLocalSession();
      return null;
    }

    try {
      const result = await this.api.post<
        ApiEnvelope<AuthTokens & { user: AuthUser }>
      >("/auth/refresh", { refreshToken });

      return await this.acceptAuthResult(result.data);
    } catch (error: unknown) {
      if (error instanceof ApiClientError && error.status === 0) {
        // A network failure is not proof that the refresh token is invalid.
        // Preserve the token so restoration can be retried later.
        throw error;
      }

      if (error instanceof ApiClientError && error.status >= 500) {
        throw error;
      }

      this.clearLocalSession();
      await this.tokenStorage.clearRefreshToken();
      return null;
    }
  }

  async getCurrentUser(): Promise<AuthUser> {
    const result = await this.api.get<ApiEnvelope<{ user: AuthUser }>>(
      "/auth/me",
    );

    this.user = result.data.user;
    return this.user;
  }

  async logout(): Promise<void> {
    try {
      if (this.user) {
        await this.api.post("/auth/logout");
      }
    } finally {
      this.clearLocalSession();
      await this.tokenStorage.clearRefreshToken();
    }
  }

  private async acceptAuthResult(
    result: AuthResult,
  ): Promise<AuthUser> {
    // Save the rotated refresh token before exposing the authenticated state.
    await this.tokenStorage.setRefreshToken(result.refreshToken);

    this.api.setAccessToken(result.accessToken);
    this.user = result.user;

    return this.user;
  }

  private clearLocalSession(): void {
    this.api.clearAccessToken();
    this.user = null;
  }
}
