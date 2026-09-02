import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth, AuthValidationError } from '@/lib/auth';
import { AuthFormField } from '@/components/AuthFormField';
import { AuthShell, AuthError } from '@/components/AuthShell';

export function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? '/work-orders';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Sign In" subtitle="Sign in to manage your work orders">
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
        <AuthFormField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />

        {error && <AuthError message={error} />}

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Sign In
        </button>

        <div className="flex items-center justify-between text-sm pt-1">
          <Link to="/forgot-password" className="font-medium text-blue-600 hover:text-blue-700">
            Forgot password?
          </Link>
          <Link to="/register" className="font-medium text-slate-500 hover:text-slate-800">
            Create account
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}

function friendlyError(err: unknown): string {
  if (err instanceof AuthValidationError) return err.message;
  const msg = err instanceof Error ? err.message : 'Something went wrong.';
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Incorrect email or password.';
  if (m.includes('email not confirmed')) return 'Please verify your email before signing in.';
  if (m.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.';
  return 'Unable to sign in. Please check your credentials and try again.';
}
