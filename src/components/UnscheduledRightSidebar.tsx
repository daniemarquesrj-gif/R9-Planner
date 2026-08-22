import React, { useState } from 'react';
import {
  Inbox,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  GripVertical,
} from 'lucide-react';
import { Task, TeamMember, UserRole } from '../types.ts';
import TaskCard from './TaskCard.tsx';

interface UnscheduledRightSidebarProps {
  tasks: Task[];
  teamMembers: TeamMember[];
  userRole: UserRole;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onTaskClick: (task: Task) => void;
  onToggleStatus: (taskId: string, e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onOpenNewTaskModal: () => void;
  onDropToUnscheduled: (e: React.DragEvent) => void;
}

export default function UnscheduledRightSidebar({
  tasks,
  teamMembers,
  userRole,
  isCollapsed,
  onToggleCollapse,
  onTaskClick,
  onToggleStatus,
  onDragStart,
  onOpenNewTaskModal,
  onDropToUnscheduled,
}: UnscheduledRightSidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const unscheduledTasks = tasks.filter((t) => !t.scheduledDate);

  const filteredTasks = unscheduledTasks.filter((task) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchTitle = task.title.toLowerCase().includes(term);
    const matchBucket = task.bucket?.toLowerCase().includes(term);
    const matchTags = task.tags?.some((t) => t.toLowerCase().includes(term));
    return matchTitle || matchBucket || matchTags;
  });

  const isAdmin = userRole === 'admin';

  if (isCollapsed) {
    return (
      <aside
        id="unscheduled-sidebar-collapsed"
        className={`h-full w-12 bg-white border-l border-zinc-200/80 flex flex-col items-center py-3 justify-between select-none shrink-0 transition-all ${
          isDragOver ? 'border-amber-500 bg-amber-50/50' : ''
        }`}
        onDragOver={(e) => {
          if (isAdmin) {
            e.preventDefault();
            setIsDragOver(true);
          }
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          if (isAdmin) {
            setIsDragOver(false);
            onDropToUnscheduled(e);
          }
        }}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
          title="Expandir Fila de Tarefas (Não Agendadas)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center text-xs font-bold"
            title={`${unscheduledTasks.length} tarefas na fila não iniciadas`}
          >
            {unscheduledTasks.length}
          </div>
          <Inbox className="w-4 h-4 text-amber-600" />
        </div>

        {isAdmin ? (
          <button
            type="button"
            onClick={onOpenNewTaskModal}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
            title="Adicionar ação na fila"
          >
            <Plus className="w-4 h-4" />
          </button>
        ) : (
          <div className="h-6" />
        )}
      </aside>
    );
  }

  return (
    <aside
      id="unscheduled-right-sidebar"
      className={`h-full w-72 lg:w-80 bg-white border-l border-zinc-200/80 flex flex-col shrink-0 select-none overflow-hidden transition-all duration-200 ${
        isDragOver ? 'ring-2 ring-amber-400 bg-amber-50/20' : ''
      }`}
      onDragOver={(e) => {
        if (isAdmin) {
          e.preventDefault();
          setIsDragOver(true);
        }
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        if (isAdmin) {
          setIsDragOver(false);
          onDropToUnscheduled(e);
        }
      }}
    >
      {/* Cabeçalho */}
      <div className="p-3.5 border-b border-zinc-200/70 flex items-center justify-between bg-zinc-50/60 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
            <Inbox className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-zinc-900 leading-tight">
                Fila Não Agendadas
              </h3>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800">
                {unscheduledTasks.length}
              </span>
            </div>
            <span className="text-[10px] text-zinc-400">
              Arraste para o calendário
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 rounded-md transition-colors cursor-pointer"
          title="Recolher painel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Alerta quando em modo DragOver para desmarcar */}
      {isDragOver && (
        <div className="p-2.5 bg-amber-50 border-b border-amber-200 text-[11px] font-semibold text-amber-800 text-center animate-pulse shrink-0">
          Solte aqui para mover para a Fila Não Agendada
        </div>
      )}

      {/* Barra de Pesquisa + Ação Rápida */}
      <div className="p-3 border-b border-zinc-100 bg-zinc-50/40 space-y-2 shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar na fila..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500/20 text-zinc-800 placeholder-zinc-400"
          />
        </div>

        {isAdmin && (
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] text-zinc-400 flex items-center gap-1">
              <GripVertical className="w-3 h-3 text-blue-500" />
              Arraste para as colunas
            </span>
            <button
              type="button"
              onClick={onOpenNewTaskModal}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Ação</span>
            </button>
          </div>
        )}
      </div>

      {/* Lista de Cards da Fila */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-zinc-50/30">
        {filteredTasks.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-3 border border-dashed border-zinc-200 rounded-xl bg-white">
            <Inbox className="w-6 h-6 text-zinc-300 mb-1.5" />
            <p className="text-xs font-semibold text-zinc-700">
              Fila vazia
            </p>
            <p className="text-[10px] text-zinc-400 mt-0.5 max-w-[180px]">
              {searchTerm
                ? 'Nenhum resultado para a busca.'
                : 'Todas as tarefas estão agendadas.'}
            </p>
            {isAdmin && !searchTerm && (
              <button
                type="button"
                onClick={onOpenNewTaskModal}
                className="mt-2.5 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer"
              >
                + Adicionar à Fila
              </button>
            )}
          </div>
        ) : (
          filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              teamMembers={teamMembers}
              userRole={userRole}
              onClick={onTaskClick}
              onToggleStatus={onToggleStatus}
              onDragStart={onDragStart}
              compact={true}
            />
          ))
        )}
      </div>

      {/* Rodapé informativo */}
      <div className="p-2.5 border-t border-zinc-200/70 bg-zinc-50/50 text-center text-[10px] text-zinc-400 shrink-0">
        {isAdmin
          ? '💡 Arraste qualquer item desta lista para os dias da semana'
          : '🔒 Visualização de membro da fila geral'}
      </div>
    </aside>
  );
}
