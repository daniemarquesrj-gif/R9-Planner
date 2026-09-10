import { useEffect, useRef, useState, useCallback } from 'react';

export interface UseIdleTimeoutOptions {
  /**
   * Tempo total de inatividade até o encerramento da sessão em milissegundos.
   * Padrão estipulado: 3 horas (10.800.000 ms).
   */
  timeoutMs?: number;
  /**
   * Tempo prévio para alerta com contagem regressiva antes do logout automático em milissegundos.
   * Padrão: 2 minutos (120.000 ms).
   */
  promptBeforeMs?: number;
  /**
   * Callback disparado quando o tempo de inatividade chegar a zero.
   * Deve realizar a limpeza de estado local, supabase.auth.signOut() e redirecionar para a tela de login.
   */
  onIdle: () => void | Promise<void>;
  /**
   * Se o monitoramento está ativado (somente para usuários com sessão ativa).
   */
  enabled?: boolean;
}

export interface UseIdleTimeoutReturn {
  isPromptOpen: boolean;
  remainingSeconds: number;
  stayLoggedIn: () => void;
  logoutNow: () => void;
  resetTimer: () => void;
}

// 3 horas = 10.800.000 ms
export const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
// 2 minutos de alerta visual prévio
export const DEFAULT_PROMPT_BEFORE_MS = 2 * 60 * 1000;

export function useIdleTimeout({
  timeoutMs = THREE_HOURS_MS,
  promptBeforeMs = DEFAULT_PROMPT_BEFORE_MS,
  onIdle,
  enabled = true,
}: UseIdleTimeoutOptions): UseIdleTimeoutReturn {
  const [isPromptOpen, setIsPromptOpen] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    Math.ceil(promptBeforeMs / 1000)
  );

  // Referências para temporizadores e estado
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isLoggingOutRef = useRef<boolean>(false);
  const onIdleRef = useRef<() => void | Promise<void>>(onIdle);

  // Manter referência sempre atualizada do callback sem causar re-execuções desnecessárias
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  // Limpeza de todos os temporizadores pendentes
  const clearAllTimers = useCallback(() => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (promptTimerRef.current) {
      clearTimeout(promptTimerRef.current);
      promptTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Disparo definitivo de logout por inatividade
  const triggerLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    clearAllTimers();
    setIsPromptOpen(false);

    try {
      console.warn('[IDLE TIMEOUT] Tempo limite de inatividade (3 horas) atingido. Desconectando usuário...');
      await onIdleRef.current();
    } catch (err) {
      console.error('[IDLE TIMEOUT] Erro ao executar logout por inatividade:', err);
    }
  }, [clearAllTimers]);

  // Inicia ou reinicia os timers a partir de agora
  const scheduleTimers = useCallback(() => {
    if (!enabled || isLoggingOutRef.current) return;

    clearAllTimers();
    lastActivityRef.current = Date.now();
    setIsPromptOpen(false);

    // 1. Agendar o Timer Principal de Logout (3 horas)
    logoutTimerRef.current = setTimeout(() => {
      triggerLogout();
    }, timeoutMs);

    // 2. Agendar o Alerta Prévio (ex: 2 minutos antes das 3 horas)
    const warningDelay = timeoutMs - promptBeforeMs;
    if (promptBeforeMs > 0 && warningDelay > 0) {
      promptTimerRef.current = setTimeout(() => {
        setIsPromptOpen(true);
        setRemainingSeconds(Math.ceil(promptBeforeMs / 1000));

        // Iniciar intervalo de contagem regressiva por segundo para exibição no modal
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
        countdownIntervalRef.current = setInterval(() => {
          const now = Date.now();
          const elapsed = now - lastActivityRef.current;
          const timeLeftMs = Math.max(0, timeoutMs - elapsed);
          const secs = Math.ceil(timeLeftMs / 1000);

          setRemainingSeconds(secs);

          if (secs <= 0) {
            triggerLogout();
          }
        }, 1000);
      }, warningDelay);
    }
  }, [enabled, timeoutMs, promptBeforeMs, clearAllTimers, triggerLogout]);

  // Manipulador de atividade do usuário com reinicialização dos timers
  const handleUserActivity = useCallback(() => {
    if (!enabled || isLoggingOutRef.current) return;

    // Se o modal de aviso estiver aberto, a interação direta do usuário através do modal
    // (Stay Logged In) ou através de eventos também prorroga o acesso
    scheduleTimers();
  }, [enabled, scheduleTimers]);

  // Função manual para manter conectado e fechar aviso
  const stayLoggedIn = useCallback(() => {
    scheduleTimers();
  }, [scheduleTimers]);

  // Função manual para encerrar sessão imediatamente
  const logoutNow = useCallback(() => {
    triggerLogout();
  }, [triggerLogout]);

  // Efeito principal: registro de ouvintes globais de eventos
  useEffect(() => {
    if (!enabled) {
      clearAllTimers();
      setIsPromptOpen(false);
      return;
    }

    // Inicializar o temporizador
    isLoggingOutRef.current = false;
    scheduleTimers();

    // Eventos estipulados para detecção de qualquer interação do usuário
    const activityEvents: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'click',
      'scroll',
      'touchstart',
      'wheel',
    ];

    // Throttle suave de 500ms para reduzir chamadas repetidas de mousemove em alta taxa de polling (ex: 1000Hz)
    let lastResetTime = Date.now();
    const throttledUserActivity = () => {
      const now = Date.now();
      if (now - lastResetTime >= 500) {
        lastResetTime = now;
        handleUserActivity();
      }
    };

    // Ouvintes atrelados a window e document com { passive: true, capture: true }
    // para interceptar qualquer interação em qualquer ponto da DOM
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, throttledUserActivity, { passive: true, capture: true });
      document.addEventListener(eventName, throttledUserActivity, { passive: true, capture: true });
    });

    // Verificação de retorno de suspensão / aba em background (acordar do sleep)
    const handleVisibilityOrFocus = () => {
      if (!enabled || isLoggingOutRef.current) return;

      const now = Date.now();
      const elapsed = now - lastActivityRef.current;

      // Se o computador ou aba ficou inativo por mais de 3 horas enquanto estava suspensa
      if (elapsed >= timeoutMs) {
        triggerLogout();
      } else {
        // Se ainda está no período de aviso ou no período normal, reajusta
        if (elapsed >= timeoutMs - promptBeforeMs && promptBeforeMs > 0) {
          setIsPromptOpen(true);
          const remaining = Math.max(0, Math.ceil((timeoutMs - elapsed) / 1000));
          setRemainingSeconds(remaining);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus, { passive: true });
    window.addEventListener('focus', handleVisibilityOrFocus, { passive: true });

    return () => {
      clearAllTimers();
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, throttledUserActivity);
        document.removeEventListener(eventName, throttledUserActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [enabled, handleUserActivity, scheduleTimers, clearAllTimers, timeoutMs, promptBeforeMs, triggerLogout]);

  return {
    isPromptOpen,
    remainingSeconds,
    stayLoggedIn,
    logoutNow,
    resetTimer: scheduleTimers,
  };
}
