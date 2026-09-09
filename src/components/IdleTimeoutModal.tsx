import React from 'react';
import { ShieldAlert, Clock, LogOut, CheckCircle2 } from 'lucide-react';

interface IdleTimeoutModalProps {
  isOpen: boolean;
  remainingSeconds: number;
  onStayLoggedIn: () => void;
  onLogoutNow: () => void;
}

export const IdleTimeoutModal: React.FC<IdleTimeoutModalProps> = ({
  isOpen,
  remainingSeconds,
  onStayLoggedIn,
  onLogoutNow,
}) => {
  if (!isOpen) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div
      id="idle-timeout-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 transition-all duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-timeout-title"
    >
      <div
        id="idle-timeout-card"
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Top Banner de Alerta Institucional */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-700">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2
              id="idle-timeout-title"
              className="text-sm font-bold text-slate-900 tracking-tight"
            >
              Aviso de Inatividade de Sessão
            </h2>
            <p className="text-xs text-amber-800/90 font-medium">
              Proteção e conformidade de acesso
            </p>
          </div>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Detectamos um período prolongado sem interação no sistema. Para garantir a segurança dos dados e evitar acessos desatendidos, sua sessão será encerrada automaticamente.
          </p>

          {/* Destaque do Cronômetro */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-slate-700">
              <Clock className="w-4 h-4 text-[#004691] animate-pulse" />
              <span className="text-xs font-semibold">Tempo restante para encerramento:</span>
            </div>
            <span
              id="idle-timeout-countdown"
              className="text-base font-mono font-bold text-[#003067] bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs"
            >
              {formattedTime}
            </span>
          </div>

          <p className="text-[11px] text-slate-500">
            Clique em <strong className="text-slate-700 font-semibold">Continuar Conectado</strong> para prosseguir com suas atividades ou em <strong className="text-slate-700 font-semibold">Sair Agora</strong> para deslogar de forma segura.
          </p>
        </div>

        {/* Rodapé de Ações */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            id="idle-logout-now-btn"
            type="button"
            onClick={onLogoutNow}
            className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair Agora</span>
          </button>
          <button
            id="idle-stay-connected-btn"
            type="button"
            onClick={onStayLoggedIn}
            autoFocus
            className="px-4 py-2 text-xs font-bold text-white bg-[#003067] hover:bg-[#00224b] rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Continuar Conectado</span>
          </button>
        </div>
      </div>
    </div>
  );
};
