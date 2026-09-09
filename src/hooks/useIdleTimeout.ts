import { useEffect, useRef, useState, useCallback } from 'react';

export interface UseIdleTimeoutOptions {
  /**
   * Tempo total de inatividade até o encerramento da sessão em milissegundos.
   * Padrão: 30 minutos (1.800.000 ms).
   */
  timeoutMs?: number;
  /**
   * Tempo prévio para alerta antes do logout automático em milissegundos.
   * Padrão: 2 minutos (120.000 ms).
   */
  promptBeforeMs?: number;
  /**
   * Callback disparado quando o tempo total de inatividade for atingido.
   */
  onIdle: () => void;
  /**
   * Se o monitoramento está ativado (ex: usuário autenticado).
   */
  enabled?: boolean;
}

export interface UseIdleTimeoutReturn {
  isPromptOpen: boolean;
  remainingSeconds: number;
  stayLoggedIn: () => void;
  logoutNow: () => void;
}

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos
const DEFAULT_PROMPT_BEFORE_MS = 2 * 60 * 1000; // 2 minutos
const THROTTLE_MS = 1000; // Evita sobrecarga de eventos

export function useIdleTimeout({
  timeoutMs = DEFAULT_TIMEOUT_MS,
  promptBeforeMs = DEFAULT_PROMPT_BEFORE_MS,
  onIdle,
  enabled = true,
}: UseIdleTimeoutOptions): UseIdleTimeoutReturn {
  const [isPromptOpen, setIsPromptOpen] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    Math.ceil(promptBeforeMs / 1000)
  );

  const lastActivityRef = useRef<number>(Date.now());
  const onIdleRef = useRef<() => void>(onIdle);

  // Manter referência estável do callback
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  // Função para resetar a inatividade e manter conectado
  const stayLoggedIn = useCallback(() => {
    lastActivityRef.current = Date.now();
    setIsPromptOpen(false);
    setRemainingSeconds(Math.ceil(promptBeforeMs / 1000));
  }, [promptBeforeMs]);

  // Função para sair imediatamente
  const logoutNow = useCallback(() => {
    setIsPromptOpen(false);
    onIdleRef.current();
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsPromptOpen(false);
      return;
    }

    lastActivityRef.current = Date.now();

    // Manipulador de atividade com throttle leve
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current > THROTTLE_MS) {
        lastActivityRef.current = now;
        // Se o aviso ainda não foi aberto, continua sem interromper a tela
      }
    };

    const activityEvents = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'wheel',
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleUserActivity, { passive: true });
    });

    // Verificação de inatividade a cada 1 segundo
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivityRef.current;

      if (elapsed >= timeoutMs) {
        setIsPromptOpen(false);
        onIdleRef.current();
      } else if (elapsed >= timeoutMs - promptBeforeMs) {
        setIsPromptOpen(true);
        const timeLeftMs = Math.max(0, timeoutMs - elapsed);
        setRemainingSeconds(Math.ceil(timeLeftMs / 1000));
      } else {
        setIsPromptOpen((prev) => (prev ? false : prev));
      }
    }, 1000);

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleUserActivity);
      });
      window.clearInterval(intervalId);
    };
  }, [enabled, timeoutMs, promptBeforeMs]);

  return {
    isPromptOpen,
    remainingSeconds,
    stayLoggedIn,
    logoutNow,
  };
}
