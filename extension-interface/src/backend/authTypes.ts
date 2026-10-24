
export interface AuthUser {
  id: string;
  email: string;
  createdAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  refreshTokenExpiresAt: string;
}

export interface AuthResult extends AuthTokens {
  user: AuthUser;
}

export interface ApiEnvelope<T> {
  data: T;
}

export interface AuthState {
  status: "loading" | "authenticated" | "unauthenticated";
  user: AuthUser | null;
}
