import { useState, type FormEvent } from 'react';
import { Loader2, LogIn } from 'lucide-react';
import AuthInput from './AuthInput.tsx';

interface LoginFormProps {
  loading: boolean;
  onLogin: (credentials: { email: string; password: string }) => void;
  onSwitchToRegister: () => void;
}

export default function LoginForm({
  loading,
  onLogin,
  onSwitchToRegister,
}: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  function validate(): boolean {
    const errors: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.';
    } else if (trimmedEmail.length > 254) {
      errors.email = 'Email must not exceed 254 characters.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    if (validate()) {
      onLogin({
        email: email.trim(),
        password,
      });
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <div className="auth-form-header">
        <h2 className="auth-heading">Sign In</h2>
        <p className="auth-subheading">
          Enter your credentials to access the SADS agent
        </p>
      </div>

      <AuthInput
        id="login-email"
        label="Email address"
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (fieldErrors.email) {
            setFieldErrors((prev) => ({ ...prev, email: undefined }));
          }
        }}
        placeholder="name@company.com"
        autoComplete="email"
        autoFocus
        required
        maxLength={254}
        error={fieldErrors.email}
        disabled={loading}
      />

      <AuthInput
        id="login-password"
        label="Password"
        type="password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (fieldErrors.password) {
            setFieldErrors((prev) => ({ ...prev, password: undefined }));
          }
        }}
        placeholder="Enter your password"
        autoComplete="current-password"
        required
        maxLength={128}
        error={fieldErrors.password}
        disabled={loading}
        showPasswordToggle
        isPasswordVisible={showPassword}
        onTogglePasswordVisibility={() => setShowPassword((prev) => !prev)}
      />

      <button
        type="submit"
        className="auth-submit-btn"
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? (
          <>
            <Loader2 size={15} className="spinner-icon" />
            <span>Signing in...</span>
          </>
        ) : (
          <>
            <LogIn size={15} />
            <span>Sign In</span>
          </>
        )}
      </button>

      <div className="auth-switch">
        <span>Don't have an account?</span>
        <button
          type="button"
          className="auth-link-button"
          onClick={onSwitchToRegister}
          disabled={loading}
        >
          Create account
        </button>
      </div>
    </form>
  );
}
