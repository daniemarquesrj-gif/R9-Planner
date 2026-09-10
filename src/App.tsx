import React, { useEffect, useState, useCallback } from 'react';
import Planner from './components/Planner.tsx';
import Login from './components/Login.jsx';
import ResetPassword from './components/ResetPassword.tsx';
import { IdleTimeoutModal } from './components/IdleTimeoutModal.tsx';
import { useIdleTimeout, THREE_HOURS_MS } from './hooks/useIdleTimeout.ts';
import { AppUpdateBanner } from './components/AppUpdateBanner.tsx';
import { useAppVersionCheck } from './hooks/useAppVersionCheck.ts';
import { supabase } from './supabase.js';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isResettingPassword, setIsResettingPassword] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const url = window.location.href;
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const path = window.location.pathname || '';

    return (
      path.includes('reset-password') ||
      hash.includes('type=recovery') ||
      search.includes('type=recovery') ||
      (hash.includes('access_token=') && hash.includes('type=recovery')) ||
      (search.includes('code=') && search.includes('type=recovery')) ||
      url.includes('recovery')
    );
  });

  // Verificação Inteligente de Versão ativada por foco de aba (visibilitychange / window.focus)
  const {
    isUpdateAvailable,
    isDismissed: isUpdateDismissed,
    latestVersion,
    applyUpdate,
    dismissUpdate,
    reopenBanner,
  } = useAppVersionCheck({
    minCheckIntervalMs: 60 * 1000, // Throttle de 1 minuto entre checagens por foco de aba
    enabled: true,
  });

  // Executa a limpeza obrigatória de estado local, supabase.auth.signOut() e força o redirecionamento
  const handleLogout = useCallback(async () => {
    try {
      console.log('[LOGOUT] Encerrando sessão do Supabase...');
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[LOGOUT] Erro ao deslogar do Supabase:', err);
    } finally {
      // 1. Limpeza do estado local do React
      setSession(null);

      // 2. Limpeza de estado local no navegador (sessionStorage e dados de autenticação em localStorage)
      try {
        sessionStorage.clear();
        Object.keys(localStorage).forEach((key) => {
          if (
            key.startsWith('sb-') ||
            key.includes('supabase') ||
            key.includes('auth') ||
            key.includes('token')
          ) {
            localStorage.removeItem(key);
          }
        });
      } catch (storageErr) {
        console.error('[LOGOUT] Erro ao limpar storage local:', storageErr);
      }

      // 3. Forçar o redirecionamento para a tela de login
      if (typeof window !== 'undefined') {
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        } else {
          window.location.reload();
        }
      }
    }
  }, []);

  // Monitoramento de Inatividade Global (Tempo limite estipulado: 3 horas)
  const { isPromptOpen, remainingSeconds, stayLoggedIn, logoutNow, startTime } = useIdleTimeout({
    startTime: Date.now(),
    timeoutMs: THREE_HOURS_MS, // 3 horas = 10.800.000 ms
    promptBeforeMs: 2 * 60 * 1000, // 2 minutos para o alerta visual com contagem
    onIdle: handleLogout,
    enabled: Boolean(session && !loading && !isResettingPassword),
  });

  useEffect(() => {
    // Verificar se há token de recuperação presente na URL/Hash
    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      const path = window.location.pathname || '';

      if (
        hash.includes('type=recovery') ||
        search.includes('type=recovery') ||
        path.includes('reset-password') ||
        (hash.includes('access_token=') && hash.includes('type=recovery'))
      ) {
        setIsResettingPassword(true);
      }
    }

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
      <>
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
        <AppUpdateBanner
          isUpdateAvailable={isUpdateAvailable}
          isDismissed={isUpdateDismissed}
          latestVersion={latestVersion}
          onApplyUpdate={applyUpdate}
          onDismiss={dismissUpdate}
          onReopen={reopenBanner}
        />
      </>
    );
  }

  if (!session) {
    return (
      <>
        <Login
          onLoginSuccess={(user) => {
            setSession({ user });
            if (typeof window !== 'undefined' && window.location.pathname === '/login') {
              window.history.replaceState({}, document.title, '/');
            }
          }}
        />
        <AppUpdateBanner
          isUpdateAvailable={isUpdateAvailable}
          isDismissed={isUpdateDismissed}
          latestVersion={latestVersion}
          onApplyUpdate={applyUpdate}
          onDismiss={dismissUpdate}
          onReopen={reopenBanner}
        />
      </>
    );
  }

  return (
    <>
      <Planner user={session.user} onLogout={handleLogout} />
      <IdleTimeoutModal
        isOpen={isPromptOpen}
        remainingSeconds={remainingSeconds}
        startTime={startTime}
        onStayLoggedIn={stayLoggedIn}
        onLogoutNow={logoutNow}
      />
      <AppUpdateBanner
        isUpdateAvailable={isUpdateAvailable}
        isDismissed={isUpdateDismissed}
        latestVersion={latestVersion}
        onApplyUpdate={applyUpdate}
        onDismiss={dismissUpdate}
        onReopen={reopenBanner}
      />
    </>
  );
}

