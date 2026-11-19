import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import type { Notice } from '../../types/workspace.ts';

interface NoticeBannerProps {
  notice: Notice | null;
  onDismiss?: () => void;
}

/** Success / error banner reusing the existing `auth-alert` styling. */
export default function NoticeBanner({ notice, onDismiss }: NoticeBannerProps) {
  if (!notice) return null;

  const isError = notice.kind === 'error';

  return (
    <div
      className={`auth-alert ${isError ? '' : 'notice-success'}`}
      role={isError ? 'alert' : 'status'}
    >
      {isError ? (
        <AlertCircle size={15} className="auth-alert-icon" aria-hidden="true" />
      ) : (
        <CheckCircle2 size={15} className="auth-alert-icon" aria-hidden="true" />
      )}
      <div className="auth-alert-content">
        <span className="auth-alert-message">{notice.text}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          className="auth-alert-close"
          onClick={onDismiss}
          aria-label="Dismiss message"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
