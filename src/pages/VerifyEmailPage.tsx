import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, MailCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AuthShell } from '@/components/AuthShell';

export function VerifyEmailPage() {
  const { user, emailVerified, resendVerification } = useAuth();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');

  // If already verified, redirect to dashboard.
  useEffect(() => {
    if (emailVerified) navigate('/work-orders', { replace: true });
  }, [emailVerified, navigate]);

  async function handleResend() {
    setSending(true);
    setStatus('idle');
    try {
      await resendVerification();
      setStatus('sent');
    } catch {
      setStatus('error');
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthShell title="Verify Your Email" subtitle="Confirm your email address">
      <div className="text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto">
          <MailCheck className="h-7 w-7 text-blue-600" aria-hidden />
        </div>
        <p className="text-sm text-slate-600">
          We sent a verification link to <strong>{user?.email ?? 'your email'}</strong>. Click the
          link in the email to activate your account.
        </p>

        {status === 'sent' && (
          <p className="text-sm text-emerald-700 flex items-center justify-center gap-1.5">
            <MailCheck className="h-4 w-4" aria-hidden /> Verification email sent again.
          </p>
        )}
        {status === 'error' && (
          <p className="text-sm text-red-600 flex items-center justify-center gap-1.5">
            <AlertCircle className="h-4 w-4" aria-hidden /> Could not resend. Please try again.
          </p>
        )}

        <button
          onClick={handleResend}
          disabled={sending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Resend Verification Email
        </button>

        <p className="text-sm text-slate-500">
          Already verified?{' '}
          <Link to="/signin" className="font-medium text-blue-600 hover:text-blue-700">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
