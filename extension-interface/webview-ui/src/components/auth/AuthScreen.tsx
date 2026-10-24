import { ShieldCheck, AlertTriangle, X, RefreshCw } from 'lucide-react';
import type { AuthMode } from '../../types/auth.ts';
import LoginForm from './LoginForm.tsx';
import RegisterForm from './RegisterForm.tsx';

interface AuthScreenProps {
  mode: AuthMode;
  loading: boolean;
  errorMessage: string | null;
  backendStatus: string;
  onClearError: () => void;
  onSwitchMode: (mode: AuthMode) => void;
  onLogin: (credentials: { email: string; password: string }) => void;
  onRegister: (credentials: { email: string; password: string }) => void;
  onTestBackend: () => void;
}

export default function AuthScreen({
  mode,
  loading,
  errorMessage,
  backendStatus,
  onClearError,
  onSwitchMode,
  onLogin,
  onRegister,
  onTestBackend,
}: AuthScreenProps) {
  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* SADS Branding */}
        <div className="auth-brand">
          <div className="auth-brand-icon" aria-hidden="true">
            <ShieldCheck size={28} />
          </div>
          <div className="auth-brand-text">
            <h1 className="auth-brand-title">SADS</h1>
            <p className="auth-brand-subtitle">
              Security-Aware Dependency Selection
            </p>
          </div>
          <span className="auth-brand-badge">AI Coding Agent</span>
        </div>

        {/* Global / API Error Alert */}
        {errorMessage && (
          <div className="auth-alert" role="alert">
            <AlertTriangle size={16} className="auth-alert-icon" aria-hidden="true" />
            <div className="auth-alert-content">
              <span className="auth-alert-message">{errorMessage}</span>
            </div>
            <button
              type="button"
              className="auth-alert-close"
              onClick={onClearError}
              aria-label="Dismiss error"
              title="Dismiss error"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Tab switchers */}
        <div className="auth-tabs" role="tablist" aria-label="Authentication Options">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              if (mode !== 'login') {
                onClearError();
                onSwitchMode('login');
              }
            }}
            disabled={loading}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => {
              if (mode !== 'register') {
                onClearError();
                onSwitchMode('register');
              }
            }}
            disabled={loading}
          >
            Register
          </button>
        </div>

        {/* Form Body */}
        {mode === 'login' ? (
          <LoginForm
            loading={loading}
            onLogin={onLogin}
            onSwitchToRegister={() => {
              onClearError();
              onSwitchMode('register');
            }}
          />
        ) : (
          <RegisterForm
            loading={loading}
            onRegister={onRegister}
            onSwitchToLogin={() => {
              onClearError();
              onSwitchMode('login');
            }}
          />
        )}

        {/* Backend health check info footer */}
        <div className="auth-backend-bar">
          <div className="auth-backend-status">
            <span
              className={`status-dot ${
                backendStatus.startsWith('Connected')
                  ? 'online'
                  : backendStatus.startsWith('Connection failed')
                  ? 'offline'
                  : 'pending'
              }`}
              aria-hidden="true"
            />
            <span className="status-label" title={backendStatus}>
              {backendStatus}
            </span>
          </div>

          <button
            type="button"
            className="text-icon-button"
            onClick={onTestBackend}
            title="Test Backend Connection"
            aria-label="Test Backend Connection"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
