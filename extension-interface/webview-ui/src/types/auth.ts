export interface AuthUser {
  id: string;
  email: string;
  createdAt?: string;
}

export interface AuthError {
  code?: string;
  status?: number;
  message: string;
}

export type AuthMode = 'login' | 'register';
