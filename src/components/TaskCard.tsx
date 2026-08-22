import React from 'react';
import {
  Circle,
  CheckCircle2,
  MessageSquare,
  Repeat,
  GripVertical,
  CheckSquare,
  SlidersHorizontal,
  AlertCircle,
} from 'lucide-react';
import { Task, TeamMember, UserRole } from '../types.ts';

interface TaskCardProps {
  task: Task;
  teamMembers: TeamMember[];
  userRole: UserRole;
  onClick: (task: Task) => void;
  onToggleStatus: (taskId: string, e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
  compact?: boolean;
  todayISO?: string;
}

export default function TaskCard({
  task,
  teamMembers,
  userRole,
  onClick,
  onToggleStatus,
  onDragStart,
  compact = false,
  todayISO = '2026-08-22',
}: TaskCardProps) {
  const isAdmin = userRole === 'admin';
  const isConcluida = task.status === 'concluida';
  const isEmAndamento = task.status === 'em_andamento';

  // Alerta de Atraso: tarefa pendente com data agendada anterior ao dia de hoje
  const isOverdue = Boolean(
    task.scheduledDate &&
    task.scheduledDate < todayISO &&
    !isConcluida
  );

  const assignedMember = teamMembers.find((m) => m.id === task.assignedTo);

  // Borda lateral para prioridade ou destaque visual suave com efeito de pulsação para atrasadas
  const getCardBorderClass = () => {
    if (isOverdue) {
      return 'border-l-[4px] border-l-rose-500 border-rose-200/90 bg-rose-50/20 ring-1 ring-rose-400/30';
    }

    switch (task.priority) {
      case 'Urgente':
        return 'border-l-[3.5px] border-l-rose-500';
      case 'Alta':
        return 'border-l-[3.5px] border-l-amber-500';
      case 'Média':
        return 'border-l-[3.5px] border-l-blue-500';
      case 'Baixa':
      default:
        return 'border-l-[3.5px] border-l-zinc-300';
    }
  };

  // Contagem de campos customizados obrigatórios preenchidos
  const requiredFieldsCount =
    task.customFields?.filter((f) => f.required).length || 0;
  const filledFieldsCount =
    task.customFieldValues?.filter((v) => {
      const fieldDef = task.customFields?.find((f) => f.id === v.fieldId);
      return (
        fieldDef?.required &&
        v.value !== '' &&
        v.value !== null &&
        v.value !== undefined
      );
    }).length || 0;

  const hasRequiredFields = requiredFieldsCount > 0;
  const isFormComplete = filledFieldsCount >= requiredFieldsCount;

  // Seleciona no máximo uma tag principal para não poluir o card
  const primaryBadge = task.bucket || (task.tags && task.tags[0]) || null;

  // Texto curto formatado para recorrência
  const getRecurrenceLabel = (rec: string) => {
    if (rec === 'Segunda a Sexta') return 'Seg–Sex';
    if (rec === 'Diariamente') return 'Diário';
    if (rec === 'Semanalmente') return 'Semanal';
    if (rec === 'Mensalmente') return 'Mensal';
    return rec;
  };

  return (
    <div
      id={`task-card-${task.id}`}
      draggable={isAdmin}
      onDragStart={(e) => {
        if (isAdmin && onDragStart) {
          onDragStart(e, task);
        }
      }}
      onClick={() => onClick(task)}
      className={`group bg-white rounded-lg border transition-all duration-150 relative select-none ${getCardBorderClass()} ${
        isAdmin
          ? 'cursor-grab active:cursor-grabbing hover:border-zinc-300 hover:shadow-sm'
          : 'cursor-pointer hover:border-zinc-300 hover:shadow-sm'
      } ${
        isConcluida
          ? 'border-zinc-200/70 bg-zinc-50/60 opacity-75'
          : isOverdue
          ? 'hover:border-rose-300 shadow-xs'
          : isEmAndamento
          ? 'border-blue-200/80 bg-white shadow-xs ring-1 ring-blue-500/10'
          : 'border-zinc-200/80 bg-white shadow-xs'
      } ${compact ? 'p-2.5' : 'p-3'}`}
    >
      {/* Alça de Arraste sutil no hover para Admin */}
      {isAdmin && (
        <div className="absolute top-2 right-1.5 opacity-0 group-hover:opacity-40 transition-opacity text-zinc-400">
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      )}

      {/* Topo do Card: Checkbox + Título + Indicador de Atraso */}
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={(e) => onToggleStatus(task.id, e)}
          className={`mt-0.5 shrink-0 transition-all cursor-pointer rounded-full ${
            isConcluida
              ? 'text-emerald-600 hover:text-emerald-700'
              : isOverdue
              ? 'text-rose-400 hover:text-rose-600'
              : 'text-zinc-300 hover:text-blue-600'
          }`}
          title={
            isConcluida
              ? 'Reabrir tarefa'
              : hasRequiredFields && !isFormComplete
              ? 'Clique para preencher os campos obrigatórios e concluir'
              : isOverdue
              ? 'Ação Atrasada - Marcar como concluída'
              : 'Marcar como concluída'
          }
        >
          {isConcluida ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Circle className="w-4 h-4 stroke-[1.75]" />
          )}
        </button>

        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4
              className={`text-[13px] font-medium leading-snug break-words transition-colors ${
                isConcluida
                  ? 'line-through text-zinc-400 font-normal'
                  : isOverdue
                  ? 'text-zinc-900 font-semibold'
                  : 'text-zinc-900 group-hover:text-zinc-950'
              }`}
            >
              {task.title}
            </h4>

            {/* Badge Indicador de Atraso com Efeito Suave de Pulsação */}
            {isOverdue && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100/90 text-rose-800 border border-rose-300/80 shadow-2xs animate-pulse shrink-0"
                title="Ação pendente com data agendada anterior a hoje"
              >
                <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                <span>Atrasada</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Linha de Metadados Sutis: Categoria Única + Recorrência Minimalista */}
      {(primaryBadge || (task.recurrence && task.recurrence !== 'Nenhuma')) && (
        <div className="mt-1.5 pl-6 flex items-center gap-1.5 flex-wrap">
          {primaryBadge && (
            <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-100/90 text-zinc-600 border border-zinc-200/50">
              {primaryBadge}
            </span>
          )}

          {task.recurrence && task.recurrence !== 'Nenhuma' && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-sky-50/80 text-sky-700 border border-sky-200/60"
              title={`Recorrência: ${task.recurrence}`}
            >
              <Repeat className="w-2.5 h-2.5" />
              <span>{getRecurrenceLabel(task.recurrence)}</span>
            </span>
          )}
        </div>
      )}

      {/* Rodapé Compacto: Avatar do Responsável + Indicadores (Formulário + Comentários) */}
      <div className="mt-2.5 pt-2 border-t border-zinc-100 flex items-center justify-between pl-0.5 text-zinc-500">
        {/* Responsável */}
        {assignedMember ? (
          <div
            className="flex items-center gap-1.5 min-w-0"
            title={`Responsável: ${assignedMember.name} (${
              assignedMember.role === 'admin' ? 'Admin' : 'Membro'
            })`}
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${assignedMember.avatarColor}`}
            >
              {assignedMember.initials}
            </div>
            <span className="text-[11px] text-zinc-600 truncate max-w-[90px] font-normal">
              {assignedMember.name.split(' ')[0]}
            </span>
          </div>
        ) : (
          <span className="text-[10px] text-zinc-400 italic">Sem responsável</span>
        )}

        {/* Indicadores Compactos alinhados à direita: Formulário + Comentários */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Indicador Elegante de Formulário / Métricas */}
          {hasRequiredFields && (
            <div
              className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                isFormComplete || isConcluida
                  ? 'text-emerald-700 bg-emerald-50/80 border border-emerald-200/60'
                  : 'text-amber-700 bg-amber-50/80 border border-amber-200/60'
              }`}
              title={
                isFormComplete || isConcluida
                  ? 'Formulário preenchido com sucesso'
                  : `Formulário pendente: ${filledFieldsCount}/${requiredFieldsCount} campos preenchidos`
              }
            >
              {isFormComplete || isConcluida ? (
                <CheckSquare className="w-3 h-3 text-emerald-600" />
              ) : (
                <SlidersHorizontal className="w-3 h-3 text-amber-600" />
              )}
              <span>
                {filledFieldsCount}/{requiredFieldsCount}
              </span>
            </div>
          )}

          {/* Indicador de Comentários */}
          {task.comments && task.comments.length > 0 && (
            <div
              className="flex items-center gap-1 text-zinc-400 hover:text-zinc-600 text-[10px]"
              title={`${task.comments.length} comentário(s)`}
            >
              <MessageSquare className="w-3 h-3" />
              <span>{task.comments.length}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

