import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth, AuthValidationError } from '@/lib/auth';
import { AuthFormField } from '@/components/AuthFormField';
import { AuthShell, AuthError } from '@/components/AuthShell';
import { isApprovedEmailDomain, PASSWORD_MIN_LENGTH } from '@/utils/validation';

export function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await signUp(email, password, email.trim().split('@')[0] || 'Team Member');
      if (result.requiresEmailConfirmation) {
        setRegistered(true);
      } else {
        navigate('/work-orders', { replace: true });
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (registered) {
    return (
      <AuthShell title="Check Your Email" subtitle="Verify your account to continue">
        <div className="text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" aria-hidden />
          <p className="text-sm text-slate-600">
            We sent a verification link to <strong>{email}</strong>. Click the link in the email to
            activate your account, then sign in.
          </p>
          <Link
            to="/signin"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Go to Sign In
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create Account" subtitle="Register with your Robson email">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <p className="text-sm text-slate-500 bg-blue-50 rounded-lg p-3 ring-1 ring-blue-100">
          Use your @robson.com email address to create an account.
        </p>
        <AuthFormField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="your.name@robson.com"
          autoComplete="email"
          required
          hint="Only @robson.com addresses can register."
          error={email && !isApprovedEmailDomain(email) ? 'This email address is not allowed to register.' : undefined}
        />
        <AuthFormField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete="new-password"
          required
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        />

        {error && <AuthError message={error} />}

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Create Account
        </button>

        <p className="text-center text-sm text-slate-500 pt-1">
          Already have an account?{' '}
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
  const msg = err instanceof Error ? err.message : 'Something went wrong.';
  const m = msg.toLowerCase();
  if (m.includes('user already registered'))
    return 'An account with this email already exists. Try signing in.';
  if (m.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.';
  return 'Unable to create your account. Please try again.';
}
