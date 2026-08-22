import React, { useState } from 'react';
import { Plus, Calendar } from 'lucide-react';
import { Task, TeamMember, UserRole } from '../types.ts';
import { formatISO, WEEKDAYS_PT, MONTH_NAMES_PT } from '../utils/dateUtils.ts';
import TaskCard from './TaskCard.tsx';

interface WeeklyViewProps {
  weekDates: Date[];
  tasks: Task[];
  teamMembers: TeamMember[];
  userRole: UserRole;
  todayDate: Date;
  onTaskClick: (task: Task) => void;
  onToggleStatus: (taskId: string, e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDropOnDate: (dateString: string, e: React.DragEvent) => void;
  onQuickAddTask: (dateString: string) => void;
}

export default function WeeklyView({
  weekDates,
  tasks,
  teamMembers,
  userRole,
  todayDate,
  onTaskClick,
  onToggleStatus,
  onDragStart,
  onDropOnDate,
  onQuickAddTask,
}: WeeklyViewProps) {
  const isAdmin = userRole === 'admin';
  const todayISO = formatISO(todayDate);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  return (
    <div className="h-full w-full p-3 sm:p-4 md:p-5 overflow-x-auto select-none bg-[#f8f9fa]/90">
      <div className="grid grid-cols-7 gap-3 sm:gap-3.5 h-full min-w-[1100px] xl:min-w-0">
        {weekDates.map((dateObj) => {
          const dateISO = formatISO(dateObj);
          const isToday = dateISO === todayISO;
          const isDragOver = dragOverDate === dateISO;
          const rawDayName = WEEKDAYS_PT[dateObj.getDay()];
          const cleanDayName = rawDayName.replace('-feira', '');
          const dayNumber = dateObj.getDate();
          const monthShort = MONTH_NAMES_PT[dateObj.getMonth()].slice(0, 3);

          // Filtrar tarefas agendadas para este dia
          const dayTasks = tasks.filter((t) => t.scheduledDate === dateISO);

          return (
            <div
              key={dateISO}
              id={`coluna-semana-${dateISO}`}
              onDragOver={(e) => {
                if (isAdmin) {
                  e.preventDefault();
                  setDragOverDate(dateISO);
                }
              }}
              onDragLeave={() => {
                if (dragOverDate === dateISO) {
                  setDragOverDate(null);
                }
              }}
              onDrop={(e) => {
                setDragOverDate(null);
                if (isAdmin) {
                  onDropOnDate(dateISO, e);
                }
              }}
              className={`flex flex-col h-full rounded-xl overflow-hidden border transition-all duration-150 ${
                isDragOver
                  ? 'border-blue-500 ring-2 ring-blue-500/25 bg-blue-50/30'
                  : isToday
                  ? 'border-blue-300/90 bg-white ring-1 ring-blue-500/20 shadow-sm'
                  : 'border-zinc-200/80 bg-zinc-50/40 shadow-2xs hover:border-zinc-300'
              }`}
            >
              {/* Cabeçalho do Dia */}
              <div
                className={`px-3.5 py-3 border-b shrink-0 flex items-center justify-between transition-colors ${
                  isToday
                    ? 'bg-blue-50/60 border-blue-200/80 text-blue-950'
                    : 'bg-white border-zinc-200/70 text-zinc-800'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {/* Número do dia */}
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isToday
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-zinc-700 font-semibold'
                    }`}
                  >
                    {dayNumber}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 leading-none">
                      <span className="text-[12px] font-semibold text-zinc-900 truncate">
                        {cleanDayName}
                      </span>
                      {isToday && (
                        <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-600 text-white leading-none">
                          Hoje
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-normal mt-0.5 block leading-none">
                      {monthShort}
                    </span>
                  </div>
                </div>

                {/* Contagem de Tarefas & Botão Quick Add */}
                <div className="flex items-center gap-1">
                  <span
                    className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                      isToday
                        ? 'bg-blue-100/80 text-blue-800'
                        : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {dayTasks.length}
                  </span>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => onQuickAddTask(dateISO)}
                      className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
                      title="Adicionar ação neste dia"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Lista de Ações do Dia */}
              <div
                className={`flex-1 p-2.5 overflow-y-auto space-y-2 transition-colors ${
                  isDragOver ? 'bg-blue-50/20' : 'bg-transparent'
                }`}
              >
                {isDragOver && (
                  <div className="border-2 border-dashed border-blue-400 rounded-lg p-3 text-center text-[11px] font-medium text-blue-700 bg-blue-50/60 animate-pulse">
                    Soltar para agendar em {dayNumber} de {monthShort}
                  </div>
                )}

                {dayTasks.length === 0 && !isDragOver ? (
                  <div className="h-36 flex flex-col items-center justify-center text-center p-3 text-zinc-400">
                    <Calendar className="w-4 h-4 opacity-25 mb-1 text-zinc-500" />
                    <p className="text-[11px] font-normal text-zinc-400">Sem tarefas</p>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => onQuickAddTask(dateISO)}
                        className="mt-1.5 text-[10px] text-blue-600 hover:text-blue-700 hover:underline font-medium cursor-pointer"
                      >
                        + Adicionar
                      </button>
                    )}
                  </div>
                ) : (
                  dayTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      teamMembers={teamMembers}
                      userRole={userRole}
                      onClick={onTaskClick}
                      onToggleStatus={onToggleStatus}
                      onDragStart={onDragStart}
                      todayISO={todayISO}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

