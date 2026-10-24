import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import type { ChangeEvent, FocusEvent } from 'react';

interface AuthInputProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  disabled?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  required?: boolean;
  maxLength?: number;
  showPasswordToggle?: boolean;
  isPasswordVisible?: boolean;
  onTogglePasswordVisibility?: () => void;
}

export default function AuthInput({
  id,
  label,
  type,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  hint,
  disabled = false,
  autoComplete,
  autoFocus = false,
  required = false,
  maxLength,
  showPasswordToggle = false,
  isPasswordVisible = false,
  onTogglePasswordVisibility,
}: AuthInputProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="form-group">
      <div className="form-label-row">
        <label htmlFor={id} className="form-label">
          {label}
          {required && <span className="required-star" aria-hidden="true">*</span>}
        </label>
      </div>

      <div className="input-wrapper">
        <input
          id={id}
          name={id}
          type={showPasswordToggle && isPasswordVisible ? 'text' : type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          maxLength={maxLength}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={`auth-input ${error ? 'has-error' : ''} ${
            showPasswordToggle ? 'has-trailing' : ''
          }`}
        />

        {showPasswordToggle && onTogglePasswordVisibility && (
          <button
            type="button"
            className="password-toggle-btn"
            onClick={onTogglePasswordVisibility}
            disabled={disabled}
            aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
            title={isPasswordVisible ? 'Hide password' : 'Show password'}
            tabIndex={0}
          >
            {isPasswordVisible ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>

      {error ? (
        <div id={errorId} className="form-error" role="alert">
          <AlertCircle size={13} className="error-icon" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : hint ? (
        <div id={hintId} className="form-hint">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
