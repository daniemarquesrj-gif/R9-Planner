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
  ChevronUp,
  Minus,
} from 'lucide-react';
import { Task, TeamMember, UserRole } from '../types.ts';
import { getTodayISO } from '../utils/dateUtils.ts';

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
  todayISO = getTodayISO(),
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

  const assigneeIds = task.assignedToIds || (task.assignedTo ? [task.assignedTo] : []);
  const assignedMembers = teamMembers.filter((m) => assigneeIds.includes(m.id));
  const primaryMember = assignedMembers[0] || teamMembers.find((m) => m.id === task.assignedTo);

  // Borda lateral para prioridade ou destaque visual suave
  const getCardBorderClass = () => {
    if (isOverdue) {
      return 'border-l-[3.5px] border-l-rose-500 border-rose-200/90 bg-rose-50/15 ring-1 ring-rose-400/20';
    }

    if (task.recurrence && task.recurrence !== 'Nenhuma') {
      return 'border-l-[3.5px] border-l-emerald-500';
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
        return 'border-l-[3.5px] border-l-slate-300';
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

  // Seleciona categoria principal
  const primaryBadge = task.bucket || (task.tags && task.tags[0]) || null;

  // Texto curto formatado para recorrência
  const getRecurrenceLabel = (rec: string) => {
    if (rec === 'Segunda a Sexta') return 'Mon-Fri';
    if (rec === 'Diariamente') return 'Daily';
    if (rec === 'Semanalmente') return 'Weekly';
    if (rec === 'Mensalmente') return 'Monthly';
    if (rec === 'Personalizado') {
      if (task.recurrenceDays && task.recurrenceDays.length > 0) {
        return task.recurrenceDays.join(', ');
      }
      return 'Custom';
    }
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
      className={`group bg-white rounded-xl border transition-all duration-150 relative select-none shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] ${getCardBorderClass()} ${
        isAdmin
          ? 'cursor-grab active:cursor-grabbing hover:border-slate-300'
          : 'cursor-pointer hover:border-slate-300'
      } ${
        isConcluida
          ? 'border-slate-200/70 bg-slate-50/60 opacity-80'
          : isOverdue
          ? 'hover:border-rose-300'
          : isEmAndamento
          ? 'border-blue-200/90 bg-white ring-1 ring-blue-500/10'
          : 'border-slate-200/90 bg-white'
      } ${compact ? 'p-2.5' : 'p-3'}`}
    >
      {/* Alça de Arraste sutil no hover para Admin */}
      {isAdmin && (
        <div className="absolute top-2.5 right-2 opacity-0 group-hover:opacity-40 transition-opacity text-slate-400">
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
              : 'text-slate-300 hover:text-[#004691]'
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
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <Circle className="w-4 h-4 stroke-[1.75] text-slate-400 hover:text-[#004691]" />
          )}
        </button>

        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4
              className={`text-[13px] font-semibold leading-snug break-words transition-colors ${
                isConcluida
                  ? 'line-through text-slate-400 font-normal'
                  : isOverdue
                  ? 'text-slate-900 font-bold'
                  : 'text-slate-900 group-hover:text-slate-950'
              }`}
            >
              {task.title}
            </h4>

            {/* Badge Indicador de Atraso */}
            {isOverdue && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-rose-100/90 text-rose-800 border border-rose-300/80 animate-pulse shrink-0"
                title="Ação pendente com data agendada anterior a hoje"
              >
                <AlertCircle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                <span>Atrasada</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Linha de Tags: Categoria + Recorrência + Prioridade */}
      {(primaryBadge || (task.recurrence && task.recurrence !== 'Nenhuma') || task.priority) && (
        <div className="mt-2 pl-6 flex items-center gap-1.5 flex-wrap">
          {primaryBadge && (
            <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/60">
              {primaryBadge}
            </span>
          )}

          {task.recurrence && task.recurrence !== 'Nenhuma' && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100/90 text-slate-700 border border-slate-200/60"
              title={`Recorrência: ${task.recurrence}`}
            >
              <Repeat className="w-2.5 h-2.5 text-slate-500" />
              <span>{getRecurrenceLabel(task.recurrence)}</span>
            </span>
          )}

          {task.priority === 'Urgente' || task.priority === 'Alta' ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200/60">
              <ChevronUp className="w-2.5 h-2.5" />
              <span>High</span>
            </span>
          ) : task.priority === 'Média' ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/60">
              <ChevronUp className="w-2.5 h-2.5" />
              <span>Med</span>
            </span>
          ) : null}
        </div>
      )}

      {/* Rodapé: Avatar do Responsável + Indicadores */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between pl-0.5 text-slate-500">
        {/* Responsáveis da Ação */}
        {assignedMembers.length > 0 ? (
          <div
            className="flex items-center gap-1.5 min-w-0"
            title={`Responsáveis: ${assignedMembers.map((m) => `${m.name} (${m.role === 'admin' ? 'Admin' : 'Membro'})`).join(', ')}`}
          >
            {/* Stack de Avatares Sobrepostos */}
            <div className="flex items-center -space-x-1.5 shrink-0">
              {assignedMembers.slice(0, 3).map((m) => (
                <div
                  key={m.id}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ring-1.5 ring-white text-white shadow-2xs shrink-0"
                  style={{ backgroundColor: m.color || '#004691' }}
                  title={m.name}
                >
                  {m.avatar || m.name.charAt(0)}
                </div>
              ))}
              {assignedMembers.length > 3 && (
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ring-1.5 ring-white bg-slate-700 text-white shadow-2xs shrink-0">
                  +{assignedMembers.length - 3}
                </div>
              )}
            </div>

            <span className="text-[11px] text-slate-600 truncate max-w-[110px] font-normal">
              {assignedMembers.length === 1
                ? (primaryMember?.name || primaryMember?.email?.split('@')[0])
                : `${primaryMember?.name?.split(' ')[0]} +${assignedMembers.length - 1}`}
            </span>
          </div>
        ) : (
          <span className="text-[10px] text-slate-400 italic">Sem responsável</span>
        )}

        {/* Indicadores Compactos: Formulário + Comentários */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Indicador de Formulário / Subtarefas */}
          {hasRequiredFields && (
            <div
              className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                isFormComplete || isConcluida
                  ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/60'
                  : 'text-amber-700 bg-amber-50 border border-amber-200/60'
              }`}
              title={
                isFormComplete || isConcluida
                  ? 'Formulário preenchido com sucesso'
                  : `Formulário pendente: ${filledFieldsCount}/${requiredFieldsCount} campos preenchidos`
              }
            >
              <CheckSquare className="w-3 h-3 text-emerald-600" />
              <span>
                {filledFieldsCount}/{requiredFieldsCount}
              </span>
            </div>
          )}

          {/* Indicador de Comentários */}
          {task.comments && task.comments.length > 0 && (
            <div
              className="flex items-center gap-1 text-slate-400 hover:text-slate-600 text-[10px]"
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


