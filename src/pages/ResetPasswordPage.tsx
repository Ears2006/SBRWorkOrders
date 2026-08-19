import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth, AuthValidationError } from '@/lib/auth';
import { AuthFormField } from '@/components/AuthFormField';
import { AuthShell, AuthError } from '@/components/AuthShell';
import { PASSWORD_MIN_LENGTH } from '@/utils/validation';

export function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => navigate('/work-orders', { replace: true }), 2000);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthShell title="Password Updated" subtitle="Your password has been changed">
        <div className="text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" aria-hidden />
          <p className="text-sm text-slate-600">
            Your password has been updated. Redirecting you to the dashboard…
          </p>
          <Link
            to="/work-orders"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Go to Dashboard
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Reset Password" subtitle="Enter your new password">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <AuthFormField
          id="new-password"
          label="New Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete="new-password"
          required
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        />
        <AuthFormField
          id="confirm-password"
          label="Confirm Password"
          type="password"
          value={confirm}
          onChange={setConfirm}
          placeholder="••••••••"
          autoComplete="new-password"
          required
        />
        {error && <AuthError message={error} />}
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Update Password
        </button>
      </form>
    </AuthShell>
  );
}

function friendlyError(err: unknown): string {
  if (err instanceof AuthValidationError) return err.message;
  return 'Unable to update your password. The reset link may have expired.';
}
