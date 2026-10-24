import { useState, type FormEvent } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import AuthInput from './AuthInput.tsx';

interface RegisterFormProps {
  loading: boolean;
  onRegister: (credentials: { email: string; password: string }) => void;
  onSwitchToLogin: () => void;
}

export default function RegisterForm({
  loading,
  onRegister,
  onSwitchToLogin,
}: RegisterFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  function validate(): boolean {
    const errors: {
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};
    const trimmedEmail = email.trim();

    // 1. Email validation
    if (!trimmedEmail) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.';
    } else if (trimmedEmail.length > 254) {
      errors.email = 'Email must not exceed 254 characters.';
    }

    // 2. Password validation (Backend requirement: min 8, max 128)
    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    } else if (password.length > 128) {
      errors.password = 'Password must not exceed 128 characters.';
    }

    // 3. Confirm password validation
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.';
    } else if (confirmPassword !== password) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    if (validate()) {
      onRegister({
        email: email.trim(),
        password,
      });
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <div className="auth-form-header">
        <h2 className="auth-heading">Create Account</h2>
        <p className="auth-subheading">
          Sign up to get started with secure dependency analysis
        </p>
      </div>

      <AuthInput
        id="register-email"
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
        id="register-password"
        label="Password"
        type="password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (fieldErrors.password) {
            setFieldErrors((prev) => ({ ...prev, password: undefined }));
          }
          if (confirmPassword && e.target.value !== confirmPassword) {
            setFieldErrors((prev) => ({
              ...prev,
              confirmPassword: 'Passwords do not match.',
            }));
          } else if (confirmPassword && e.target.value === confirmPassword) {
            setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
          }
        }}
        placeholder="At least 8 characters"
        autoComplete="new-password"
        required
        maxLength={128}
        hint="Must be at least 8 characters."
        error={fieldErrors.password}
        disabled={loading}
        showPasswordToggle
        isPasswordVisible={showPassword}
        onTogglePasswordVisibility={() => setShowPassword((prev) => !prev)}
      />

      <AuthInput
        id="register-confirm-password"
        label="Confirm password"
        type="password"
        value={confirmPassword}
        onChange={(e) => {
          setConfirmPassword(e.target.value);
          if (fieldErrors.confirmPassword) {
            setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
          }
        }}
        placeholder="Re-enter your password"
        autoComplete="new-password"
        required
        maxLength={128}
        error={fieldErrors.confirmPassword}
        disabled={loading}
        showPasswordToggle
        isPasswordVisible={showConfirmPassword}
        onTogglePasswordVisibility={() =>
          setShowConfirmPassword((prev) => !prev)
        }
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
            <span>Creating account...</span>
          </>
        ) : (
          <>
            <UserPlus size={15} />
            <span>Create Account</span>
          </>
        )}
      </button>

      <div className="auth-switch">
        <span>Already have an account?</span>
        <button
          type="button"
          className="auth-link-button"
          onClick={onSwitchToLogin}
          disabled={loading}
        >
          Sign in
        </button>
      </div>
    </form>
  );
}
