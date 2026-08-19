import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth, AuthValidationError } from '@/lib/auth';
import { AuthFormField } from '@/components/AuthFormField';
import { AuthError } from '@/components/AuthShell';
import { useToast } from '@/contexts/ToastContext';
import { PASSWORD_MIN_LENGTH } from '@/utils/validation';

export function ChangePasswordPage() {
  const { updatePassword } = useAuth();
  const { showToast } = useToast();

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
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(password);
      setDone(true);
      showToast('Your password has been changed successfully.', 'success');
      setPassword('');
      setConfirm('');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto">
        <BackLink />
        <div className="mt-6 bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" aria-hidden />
          <h2 className="mt-4 text-xl font-bold text-slate-900">Password Changed</h2>
          <p className="mt-2 text-sm text-slate-600">
            Your password has been updated. You can continue using the app with your new password.
          </p>
          <Link
            to="/work-orders"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <BackLink />
      <div className="mt-6 bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-slate-900">Change Password</h2>
        <p className="mt-1 text-sm text-slate-500">
          Enter a new password for your account. You'll stay signed in.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
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
            label="Confirm New Password"
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
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/work-orders"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back to Dashboard
    </Link>
  );
}

function friendlyError(err: unknown): string {
  if (err instanceof AuthValidationError) return err.message;
  return 'Unable to update your password. Please try again.';
}
