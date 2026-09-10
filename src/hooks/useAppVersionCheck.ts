import { useEffect, useRef, useState, useCallback } from 'react';

export interface UseAppVersionCheckOptions {
  /**
   * Intervalo mínimo entre verificações ao focar a aba (em milissegundos).
   * Padrão: 60.000 ms (1 minuto) para evitar requisições redundantes em trocas rápidas de aba.
   */
  minCheckIntervalMs?: number;
  /**
   * Habilita ou desabilita a checagem automática por foco.
   * Padrão: true.
   */
  enabled?: boolean;
}

export interface UseAppVersionCheckReturn {
  isUpdateAvailable: boolean;
  isChecking: boolean;
  latestVersion: string | null;
  currentVersion: string | null;
  isDismissed: boolean;
  applyUpdate: () => void;
  dismissUpdate: () => void;
  reopenBanner: () => void;
  checkForUpdate: () => Promise<boolean>;
}

// Extrai o identificador da versão atual em execução no navegador
function getInitialAppVersion(): string | null {
  if (typeof document === 'undefined') return null;

  // 1. Verificar meta tag específica injetada no build
  const metaBuildId = document.querySelector('meta[name="app-build-id"]')?.getAttribute('content');
  if (metaBuildId && metaBuildId.trim() !== '') {
    return metaBuildId.trim();
  }

  // 2. Verificar variável global injetada via define do Vite
  try {
    if (typeof __APP_BUILD_ID__ !== 'undefined' && __APP_BUILD_ID__) {
      return String(__APP_BUILD_ID__);
    }
  } catch {
    // Ignora se não existir
  }

  // 3. Extrair assinatura do script principal do Vite (ex: /assets/index-Bx8z1.js)
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'));
  for (const script of scripts) {
    const src = script.getAttribute('src') || '';
    if (src.includes('/assets/') || src.includes('main.tsx')) {
      return src;
    }
  }

  return null;
}

export function useAppVersionCheck({
  minCheckIntervalMs = 60 * 1000, // 1 minuto de throttle entre checagens
  enabled = true,
}: UseAppVersionCheckOptions = {}): UseAppVersionCheckReturn {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string | null>(() => getInitialAppVersion());
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  const currentVersionRef = useRef<string | null>(currentVersion);
  const lastCheckTimestampRef = useRef<number>(0);
  const isCheckingRef = useRef<boolean>(false);

  // Mantém a ref sincronizada com o estado
  useEffect(() => {
    currentVersionRef.current = currentVersion;
  }, [currentVersion]);

  // Função central de verificação de nova versão (leve e não intrusiva)
  const checkForUpdate = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || isCheckingRef.current) {
      return false;
    }

    isCheckingRef.current = true;
    setIsChecking(true);
    lastCheckTimestampRef.current = Date.now();

    try {
      const timestamp = Date.now();
      // 1. Tentar buscar o version.json leve com cache-busting
      const versionResponse = await fetch(`/version.json?_t=${timestamp}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Accept: 'application/json',
        },
      });

      let detectedVersion: string | null = null;

      if (versionResponse.ok) {
        const contentType = versionResponse.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await versionResponse.json();
          if (data && typeof data.version === 'string') {
            detectedVersion = data.version;
          }
        }
      }

      // 2. Fallback inteligente: se version.json não retornar JSON (ex: interceptado por rewrite Vercel para index.html)
      // Faz uma checagem rápida no index.html procurando meta tag ou hashes de scripts
      if (!detectedVersion) {
        const htmlResponse = await fetch(`/?_t=${timestamp}`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
        });

        if (htmlResponse.ok) {
          const htmlText = await htmlResponse.text();

          // Procurar meta tag <meta name="app-build-id" content="...">
          const metaMatch = htmlText.match(/<meta\s+name=["']app-build-id["']\s+content=["']([^"']+)["']/i);
          if (metaMatch && metaMatch[1]) {
            detectedVersion = metaMatch[1].trim();
          } else {
            // Procurar tag de script principal com hash do Vite
            const scriptMatch = htmlText.match(/src=["'](\/assets\/[^"']+\.js)["']/i);
            if (scriptMatch && scriptMatch[1]) {
              detectedVersion = scriptMatch[1].trim();
            }
          }
        }
      }

      // Se obtivemos uma versão remota válida
      if (detectedVersion) {
        // Se ainda não tínhamos uma versão de base registrada, memoriza a primeira
        if (!currentVersionRef.current) {
          currentVersionRef.current = detectedVersion;
          setCurrentVersion(detectedVersion);
          return false;
        }

        // Comparação estrita entre a versão remota e a versão em execução
        if (detectedVersion !== currentVersionRef.current) {
          console.info(
            `[APP UPDATE] Nova versão detectada! Atual: ${currentVersionRef.current} | Nova: ${detectedVersion}`
          );
          setLatestVersion(detectedVersion);
          setIsUpdateAvailable(true);
          return true;
        }
      }

      return false;
    } catch (err) {
      // Falhas de rede ou offline não devem afetar a experiência do usuário
      console.debug('[APP UPDATE] Verificação silenciosa de versão não concluída (rede/offline):', err);
      return false;
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  }, []);

  // Executa checagem inicial única ao montar se não souber a versão base
  useEffect(() => {
    if (!currentVersionRef.current) {
      checkForUpdate();
    }
  }, [checkForUpdate]);

  // Listener para foco da aba (visibilitychange e window.focus)
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleVisibilityOrFocus = () => {
      // Apenas executa quando a aba se torna visível / ativa
      if (document.visibilityState !== 'visible') {
        return;
      }

      const now = Date.now();
      const elapsedSinceLastCheck = now - lastCheckTimestampRef.current;

      // Throttle: só verifica se já passou o tempo mínimo estipulado (ex: 60s)
      if (elapsedSinceLastCheck >= minCheckIntervalMs) {
        checkForUpdate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus, { passive: true });
    window.addEventListener('focus', handleVisibilityOrFocus, { passive: true });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [enabled, minCheckIntervalMs, checkForUpdate]);

  // O usuário decide quando recarregar a aplicação de forma segura
  const applyUpdate = useCallback(() => {
    if (typeof window !== 'undefined') {
      console.log('[APP UPDATE] Usuário solicitou recarregamento para aplicar nova versão...');
      window.location.reload();
    }
  }, []);

  // Dispensar o banner para não atrapalhar o preenchimento de formulários
  const dismissUpdate = useCallback(() => {
    setIsDismissed(true);
  }, []);

  // Reabrir o banner caso o usuário queira atualizar mais tarde
  const reopenBanner = useCallback(() => {
    setIsDismissed(false);
  }, []);

  return {
    isUpdateAvailable,
    isChecking,
    latestVersion,
    currentVersion,
    isDismissed,
    applyUpdate,
    dismissUpdate,
    reopenBanner,
    checkForUpdate,
  };
}
