import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, whatsapp?: string, redirectTo?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const WELCOME_SENT_PREFIX = 'welcome-email-enviado:';

/** Envia o e-mail de boas-vindas apenas depois que o e-mail foi confirmado. */
function maybeSendWelcome(user: User | null) {
  if (!user?.id || !user.email || !user.email_confirmed_at) return;
  const key = `${WELCOME_SENT_PREFIX}${user.id}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
  } catch {
    /* ignore */
  }
  supabase.functions
    .invoke('send-transactional-email', {
      body: {
        templateName: 'welcome',
        recipientEmail: user.email,
        idempotencyKey: `welcome-${user.id}`,
        templateData: {},
      },
    })
    .catch((e) => console.warn('welcome email failed', e));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      maybeSendWelcome(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      maybeSendWelcome(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, whatsapp?: string, redirectTo?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: whatsapp ? { whatsapp } : undefined,
        emailRedirectTo: redirectTo,
      },
    });

    // O e-mail de boas-vindas é enviado somente depois que o e-mail é confirmado
    // (ver maybeSendWelcome).
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
