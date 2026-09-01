import React, { useEffect, useState } from 'react';
import Planner from './components/Planner.tsx';
import Login from './components/Login.jsx';
import ResetPassword from './components/ResetPassword.tsx';
import { supabase } from './supabase.js';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isResettingPassword, setIsResettingPassword] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.location.pathname.includes('reset-password') ||
      window.location.hash.includes('type=recovery') ||
      window.location.search.includes('type=recovery')
    );
  });

  useEffect(() => {
    // Obter a sessão atual do Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Ouvir mudanças de autenticação (login, logout, refresh, password recovery)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPassword(true);
      }
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500 text-sm">
          <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Carregando...</span>
        </div>
      </div>
    );
  }

  // Rota/Tela dedicada de Redefinição de Senha
  if (isResettingPassword) {
    return (
      <ResetPassword
        onPasswordResetSuccess={(user) => {
          setIsResettingPassword(false);
          if (user) {
            setSession({ user });
          }
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, document.title, '/');
          }
        }}
        onCancel={() => {
          setIsResettingPassword(false);
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, document.title, '/');
          }
        }}
      />
    );
  }

  if (!session) {
    return <Login onLoginSuccess={(user) => setSession({ user })} />;
  }

  return <Planner user={session.user} onLogout={handleLogout} />;
}

