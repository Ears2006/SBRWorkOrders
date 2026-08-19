import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { isApprovedEmailDomain, isValidEmailFormat, isValidPassword } from '@/utils/validation';
import type { Profile } from '@/types';

interface SignUpResult {
  requiresEmailConfirmation: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  emailVerified: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  resendVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export class AuthValidationError extends Error {}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mountedRef.current) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchProfile(data.session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load profile:', error.message);
    }
    if (mountedRef.current) {
      setProfile(data as Profile | null);
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    if (!isValidEmailFormat(email)) {
      throw new AuthValidationError('Please enter a valid email address.');
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }

  async function signUp(email: string, password: string, fullName: string) {
    const trimmedEmail = email.trim();
    if (!isValidEmailFormat(trimmedEmail)) {
      throw new AuthValidationError('Please enter a valid email address.');
    }
    if (!isApprovedEmailDomain(trimmedEmail)) {
      throw new AuthValidationError('This email address is not allowed to register.');
    }
    if (fullName.trim().length < 2) {
      throw new AuthValidationError('Please enter your full name.');
    }
    if (!isValidPassword(password)) {
      throw new AuthValidationError(`Password must be at least ${6} characters.`);
    }

    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    if (error) throw error;

    // When email confirmation is enabled, no session is returned.
    if (data.session) {
      setSession(data.session);
      setUser(data.session.user);
      await fetchProfile(data.session.user.id);
      return { requiresEmailConfirmation: false };
    }
    return { requiresEmailConfirmation: true };
  }

  async function sendPasswordReset(email: string) {
    if (!isValidEmailFormat(email)) {
      throw new AuthValidationError('Please enter a valid email address.');
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }

  async function updatePassword(newPassword: string) {
    if (!isValidPassword(newPassword)) {
      throw new AuthValidationError(`Password must be at least ${6} characters.`);
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  async function resendVerification() {
    const email = user?.email;
    if (!email) throw new Error('No user to verify.');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/verify-email` },
    });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  const emailVerified = !!user?.email_confirmed_at;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        emailVerified,
        signIn,
        signUp,
        signOut,
        sendPasswordReset,
        updatePassword,
        resendVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
