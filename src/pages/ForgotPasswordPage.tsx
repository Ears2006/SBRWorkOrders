import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth, AuthValidationError } from '@/lib/auth';
import { AuthFormField } from '@/components/AuthFormField';
import { AuthShell, AuthError } from '@/components/AuthShell';

export function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthShell title="Check Your Email" subtitle="Password reset link sent">
        <div className="text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" aria-hidden />
          <p className="text-sm text-slate-600">
            If an account exists for <strong>{email}</strong>, we've sent a link to reset your
            password. Check your inbox and follow the link to set a new password.
          </p>
          <Link
            to="/signin"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Back to Sign In
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot Password" subtitle="We'll send you a reset link">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <AuthFormField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@robson.com"
          autoComplete="email"
          required
        />
        {error && <AuthError message={error} />}
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Send Reset Link
        </button>
        <p className="text-center text-sm text-slate-500 pt-1">
          Remembered it?{' '}
          <Link to="/signin" className="font-medium text-blue-600 hover:text-blue-700">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

function friendlyError(err: unknown): string {
  if (err instanceof AuthValidationError) return err.message;
  return 'Unable to send reset link. Please try again.';
}
