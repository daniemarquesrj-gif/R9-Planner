import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Calendar,
  CalendarDays,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  LogOut,
  PanelLeft,
  CheckCircle2,
  Inbox,
  TrendingUp,
  RefreshCw,
  Database,
} from 'lucide-react';
import { Task, TeamMember, UserRole, CustomFieldValue } from '../types.ts';
import {
  TEAM_MEMBERS,
  INITIAL_TASKS,
} from '../data/mockData.ts';
import {
  getWeekDates,
  formatWeekInterval,
  getMonthGrid,
  MONTH_NAMES_PT,
  formatISO,
  getNextRecurrenceDate,
} from '../utils/dateUtils.ts';
import { taskService, mapDbRowToTask } from '../services/taskService.ts';
import { supabase } from '../supabase.js';
import WeeklyView from './WeeklyView.tsx';
import MonthlyView from './MonthlyView.tsx';
import TaskDetailModal from './TaskDetailModal.tsx';
import NewTaskModal from './NewTaskModal.tsx';
import TaskCompletionModal from './TaskCompletionModal.tsx';
import LeftSidebar, { SidebarTab, NavFilter } from './LeftSidebar.tsx';

interface PlannerProps {
  user?: { email?: string };
  onLogout?: () => void;
}

export default function Planner({ user, onLogout }: PlannerProps) {
  // Estado das Tarefas e Membros
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [teamMembers] = useState<TeamMember[]>(TEAM_MEMBERS);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);

  // RBAC: Perfil do usuário atual e Alternador de Papel (para teste rápido)
  const [userRole, setUserRole] = useState<UserRole>('admin');

  const currentUser: TeamMember = useMemo(() => {
    return (
      teamMembers.find((m) => m.email === user?.email) || {
        id: 'user-current',
        name: user?.email ? user.email.split('@')[0] : 'Daniel Marques',
        email: user?.email || 'danie.marques.rj@gmail.com',
        role: userRole,
        avatarColor: 'bg-blue-600 text-white',
        initials: 'DM',
      }
    );
  }, [user, teamMembers, userRole]);

  // Carregamento Inicial (Fetch) do Supabase
  const loadTasksFromSupabase = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoadingTasks(true);
    else setIsSyncing(true);

    try {
      const { data, error } = await taskService.fetchTasks();

      if (error) {
        console.warn('Conexão ao Supabase com aviso:', error.message);
        setDbConnected(false);
      } else {
        setDbConnected(true);
        if (data && data.length > 0) {
          setTasks(data);
        } else if (isInitial && (!data || data.length === 0)) {
          // Se a tabela estiver vazia na primeira execução, tenta semear tarefas de exemplo ou mantém lista
          try {
            const seeded = await taskService.seedInitialTasks();
            if (seeded && seeded.length > 0) {
              setTasks(seeded);
            }
          } catch (seedErr) {
            console.log('Mantendo tarefas padrão na inicialização:', seedErr);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar tarefas do Supabase:', err);
      setDbConnected(false);
    } finally {
      setIsLoadingTasks(false);
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    loadTasksFromSupabase(true);

    // Canal Realtime do Supabase para manter tudo sincronizado entre abas/usuários
    const channel = supabase
      .channel('tarefas-planner-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tarefas',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTask = mapDbRowToTask(payload.new);
            setTasks((prev) => {
              if (prev.some((t) => t.id === newTask.id)) return prev;
              return [newTask, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedTask = mapDbRowToTask(payload.new);
            setTasks((prev) =>
              prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = String(payload.old.id);
            setTasks((prev) => prev.filter((t) => t.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTasksFromSupabase]);

  // Visualização de Alto Nível: 'week' ou 'month'
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  // Data de Navegação de Referência (Âncora real da aplicação)
  const [currentReferenceDate, setCurrentReferenceDate] = useState<Date>(
    new Date(2026, 7, 22) // 22 de Agosto de 2026
  );
  const todayDate = useMemo(() => new Date(2026, 7, 22), []);
  const todayISO = useMemo(() => formatISO(todayDate), [todayDate]);

  // Modais
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [defaultNewTaskDate, setDefaultNewTaskDate] = useState<string | null>(null);

  // Modal de Conclusão Obrigatória (quando a ação tem campos não preenchidos)
  const [completingTask, setCompletingTask] = useState<Task | null>(null);
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);

  // Notificação Toast para feedback de recorrência e ações
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Estado de Arrastar e Soltar
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Estados de Controle do Menu Lateral Esquerdo Unificado
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('planner');

  // Filtros de Produtividade
  const [navFilter, setNavFilter] = useState<NavFilter>('all');
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);

  // Lista única de Buckets / Categorias
  const allBuckets = useMemo(() => {
    const bucketsSet = new Set<string>();
    tasks.forEach((t) => {
      if (t.bucket) bucketsSet.add(t.bucket);
    });
    return Array.from(bucketsSet);
  }, [tasks]);

  // Contagens para a barra de navegação
  const navCounts = useMemo(() => {
    const myDayCount = tasks.filter((t) => {
      const isToday = t.scheduledDate === todayISO;
      return userRole === 'admin' ? isToday : isToday && t.assignedTo === currentUser.id;
    }).length;

    const myTasksCount = tasks.filter((t) => t.assignedTo === currentUser.id).length;
    const allCount = tasks.length;
    const urgentCount = tasks.filter((t) => t.priority === 'Urgente' || t.priority === 'Alta').length;
    const unscheduledCount = tasks.filter((t) => !t.scheduledDate).length;

    return {
      myDay: myDayCount,
      myTasks: myTasksCount,
      all: allCount,
      urgent: urgentCount,
      unscheduled: unscheduledCount,
    };
  }, [tasks, todayISO, currentUser.id, userRole]);

  // Cálculo das datas da semana atual
  const weekDates = useMemo(
    () => getWeekDates(currentReferenceDate),
    [currentReferenceDate]
  );

  // Cálculo da grade do mês atual
  const monthCells = useMemo(
    () =>
      getMonthGrid(
        currentReferenceDate.getFullYear(),
        currentReferenceDate.getMonth(),
        todayDate
      ),
    [currentReferenceDate, todayDate]
  );

  // Filtragem de tarefas exibidas na grade do calendário
  const displayedTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Filtro por Bucket / Categoria
      if (selectedBucket && task.bucket !== selectedBucket) {
        return false;
      }

      // Filtro por Navegação (Meu Dia / Minhas Tarefas / Urgente / Planejador Geral)
      if (navFilter === 'my_tasks') {
        if (task.assignedTo !== currentUser.id) return false;
      } else if (navFilter === 'my_day') {
        if (task.scheduledDate !== todayISO) return false;
      } else if (navFilter === 'urgent') {
        if (task.priority !== 'Urgente' && task.priority !== 'Alta') return false;
      }

      return true;
    });
  }, [tasks, selectedBucket, navFilter, currentUser.id, todayISO]);

  // Navegação de datas (Anterior / Próximo / Hoje)
  const handlePrev = () => {
    const nextDate = new Date(currentReferenceDate);
    if (viewMode === 'week') {
      nextDate.setDate(nextDate.getDate() - 7);
    } else {
      nextDate.setMonth(nextDate.getMonth() - 1);
    }
    setCurrentReferenceDate(nextDate);
  };

  const handleNext = () => {
    const nextDate = new Date(currentReferenceDate);
    if (viewMode === 'week') {
      nextDate.setDate(nextDate.getDate() + 7);
    } else {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
    setCurrentReferenceDate(nextDate);
  };

  const handleToday = () => {
    setCurrentReferenceDate(new Date(todayDate));
  };

  // Drag & Drop Handlers (Admin Only com Persistência Imediata no Supabase)
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    if (userRole !== 'admin') return;
    setDraggedTaskId(task.id);
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropOnDate = async (targetDateString: string, e: React.DragEvent) => {
    if (userRole !== 'admin') return;
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!taskId) return;

    // Atualização otimista imediata na UI
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, scheduledDate: targetDateString } : t
      )
    );
    setDraggedTaskId(null);

    // Persistência em tempo real no Supabase
    const { error } = await taskService.updateScheduledDate(taskId, targetDateString);
    if (error) {
      setToastMessage('Aviso: salvo localmente. Verifique a conexão com o Supabase.');
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      const [y, m, d] = targetDateString.split('-');
      setToastMessage(`Ação alocada para ${d}/${m} no Supabase.`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleDropToUnscheduled = async (e: React.DragEvent) => {
    if (userRole !== 'admin') return;
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!taskId) return;

    // Atualização otimista imediata na UI (mover para a Fila)
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, scheduledDate: null } : t))
    );
    setDraggedTaskId(null);

    // Persistência em tempo real no Supabase (data_agendada: null)
    const { error } = await taskService.updateScheduledDate(taskId, null);
    if (error) {
      setToastMessage('Aviso: salvo localmente. Verifique a conexão com o Supabase.');
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      setToastMessage('Ação movida para a Fila de Não Agendadas no Supabase.');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Execução unificada da conclusão de tarefas com suporte a Geração Automática por Recorrência no Supabase
  const executeCompleteTask = async (
    taskId: string,
    filledValues?: CustomFieldValue[]
  ) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask) return;

    // Executa a atualização no Supabase com lógica de recorrência
    const { updatedTask, nextRecurrentTask, error } =
      await taskService.updateTaskStatus(targetTask, 'concluida', filledValues);

    setTasks((prev) => {
      const updatedList = prev.map((t) => (t.id === taskId ? updatedTask : t));
      if (nextRecurrentTask) {
        return [nextRecurrentTask, ...updatedList];
      }
      return updatedList;
    });

    if (nextRecurrentTask && nextRecurrentTask.scheduledDate) {
      const [ny, nm, nd] = nextRecurrentTask.scheduledDate.split('-');
      setToastMessage(
        `Tarefa concluída! Nova ocorrência inserida no Supabase para ${nd}/${nm} (${targetTask.recurrence}).`
      );
      setTimeout(() => setToastMessage(null), 6000);
    } else {
      setToastMessage(`Tarefa "${targetTask.title}" concluída com sucesso no Supabase.`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Regra de Conclusão de Status
  const handleToggleStatus = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (task.status === 'concluida') {
      // Reverter para pendente no Supabase
      const { updatedTask } = await taskService.updateTaskStatus(task, 'pendente');
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? updatedTask : t))
      );
      setToastMessage(`Tarefa "${task.title}" reaberta como pendente no Supabase.`);
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    // Se estiver marcando como concluída, verificar se há campos customizados obrigatórios
    const hasUnfilledRequiredFields = task.customFields?.some((f) => {
      if (!f.required) return false;
      const filled = task.customFieldValues?.find((v) => v.fieldId === f.id);
      return (
        filled === undefined ||
        filled.value === '' ||
        filled.value === null ||
        filled.value === undefined
      );
    });

    if (hasUnfilledRequiredFields) {
      // Abre o modal de preenchimento obrigatório
      setCompletingTask(task);
      setIsCompletionModalOpen(true);
    } else {
      // Conclui diretamente e gera a próxima ocorrência recorrente caso aplicável
      await executeCompleteTask(taskId);
    }
  };

  // Confirmação de conclusão vinda do modal de preenchimento
  const handleConfirmCompletion = async (
    taskId: string,
    filledValues: CustomFieldValue[]
  ) => {
    await executeCompleteTask(taskId, filledValues);
    setIsCompletionModalOpen(false);
    setCompletingTask(null);
  };

  // Abrir detalhes da ação
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  // Atualizar ação existente (com persistência no Supabase)
  const handleUpdateTask = async (updated: Task) => {
    // Atualização otimista
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelectedTask(updated);

    // Persistir no Supabase
    const { data: savedTask, error } = await taskService.updateTask(updated);
    if (!error && savedTask) {
      setTasks((prev) => prev.map((t) => (t.id === savedTask.id ? savedTask : t)));
      setSelectedTask(savedTask);
    }
  };

  // Excluir ação existente (com persistência no Supabase)
  const handleDeleteTask = async (taskId: string) => {
    if (userRole !== 'admin') return;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (selectedTask?.id === taskId) {
      setSelectedTask(null);
    }

    await taskService.deleteTask(taskId);
    setToastMessage('Ação removida do Supabase.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Criar nova ação (com persistência no Supabase)
  const handleCreateTask = async (newTaskData: Omit<Task, 'id' | 'comments'>) => {
    if (userRole !== 'admin') return;

    setIsSyncing(true);
    const { data: createdTask, error } = await taskService.createTask(newTaskData);
    setIsSyncing(false);

    if (createdTask) {
      setTasks((prev) => [createdTask, ...prev]);
      if (createdTask.scheduledDate) {
        const [y, m, d] = createdTask.scheduledDate.split('-');
        setToastMessage(`Nova ação criada e agendada para ${d}/${m} no Supabase.`);
      } else {
        setToastMessage('Nova ação criada na Fila de Não Agendadas no Supabase.');
      }
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleQuickAddTask = (dateString: string) => {
    if (userRole !== 'admin') return;
    setDefaultNewTaskDate(dateString);
    setIsNewTaskOpen(true);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-white overflow-hidden select-none font-sans text-zinc-900">
      {/* 1. Barra Superior Principal Estilo Moderno e Limpo */}
      <header
        id="planner-main-header"
        className="h-14 px-3 sm:px-5 border-b border-zinc-200/80 bg-white flex items-center justify-between shrink-0 gap-2 sm:gap-4 z-20"
      >
        {/* Esquerda: Toggle do Menu Lateral + Título */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setIsLeftSidebarCollapsed((prev) => !prev)}
            className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
            title={isLeftSidebarCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-zinc-900 leading-none tracking-tight">
              Planner de Equipe
            </h1>
            {selectedBucket && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-md border border-zinc-200/60">
                <span>Plano:</span>
                <span className="text-blue-600">{selectedBucket}</span>
              </span>
            )}
          </div>
        </div>

        {/* Centro: Seletor de Visão (Semana / Mês) + Navegação de Período */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Seletor Semana / Mês */}
          <div className="bg-zinc-100/90 p-0.5 rounded-lg flex items-center border border-zinc-200/60">
            <button
              id="view-mode-week-button"
              type="button"
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                viewMode === 'week'
                  ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Semana</span>
            </button>

            <button
              id="view-mode-month-button"
              type="button"
              onClick={() => setViewMode('month')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                viewMode === 'month'
                  ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mês</span>
            </button>
          </div>

          {/* Navegação de Data */}
          <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200/70 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 rounded-md transition-colors cursor-pointer"
              title="Período anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleToday}
              className="px-2 py-0.5 text-xs font-medium text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200/60 shadow-2xs rounded-md transition-colors cursor-pointer"
            >
              Hoje
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 rounded-md transition-colors cursor-pointer"
              title="Próximo período"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Texto do Intervalo formatado */}
            <span className="text-xs font-semibold text-zinc-800 ml-1.5 hidden md:inline-block pr-1.5">
              {viewMode === 'week'
                ? formatWeekInterval(weekDates)
                : `${MONTH_NAMES_PT[currentReferenceDate.getMonth()]} de ${currentReferenceDate.getFullYear()}`}
            </span>
          </div>
        </div>

        {/* Direita: Status Supabase, Perfil RBAC e Logout */}
        <div className="flex items-center gap-2">
          {/* Indicador de Conexão Supabase / Botão de Sincronizar */}
          <button
            id="supabase-sync-status-button"
            type="button"
            onClick={() => loadTasksFromSupabase(false)}
            disabled={isSyncing}
            className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              dbConnected === true
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/70'
                : dbConnected === false
                ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/70'
                : 'bg-zinc-50 text-zinc-600 border-zinc-200'
            }`}
            title="Sincronizar tarefas com o Supabase"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isSyncing
                  ? 'bg-blue-500 animate-spin'
                  : dbConnected === true
                  ? 'bg-emerald-500'
                  : 'bg-amber-500 animate-pulse'
              }`}
            />
            <span className="text-[11px] font-medium">
              {isSyncing
                ? 'Sincronizando...'
                : dbConnected === true
                ? 'Supabase Ativo'
                : 'Supabase'}
            </span>
            <RefreshCw className={`w-3 h-3 text-zinc-400 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Alternador de Perfil RBAC (Admin / Membro) */}
          <div className="flex items-center gap-1 bg-zinc-100/90 border border-zinc-200/70 px-1.5 py-0.5 rounded-lg">
            <span className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider hidden xl:inline">
              Perfil:
            </span>
            <button
              id="rbac-role-toggle-button"
              type="button"
              onClick={() =>
                setUserRole((prev) => (prev === 'admin' ? 'member' : 'admin'))
              }
              className={`text-[11px] font-semibold px-2 py-0.5 rounded transition-all cursor-pointer ${
                userRole === 'admin'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
              title="Clique para alternar permissão (Admin / Membro)"
            >
              {userRole === 'admin' ? '🛡️ Admin' : '👤 Membro'}
            </button>
          </div>

          {/* Botão de Sair */}
          <button
            id="header-logout-button"
            type="button"
            onClick={onLogout}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
            title="Sair da conta"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. Estrutura Limpa: Menu Lateral Esquerdo Unificado + Grade Central Espaçosa */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* Menu Lateral Esquerdo Unificado (Tabs / Cascata) */}
        <LeftSidebar
          userRole={userRole}
          currentUser={currentUser}
          tasks={tasks}
          teamMembers={teamMembers}
          todayISO={todayISO}
          todayDate={todayDate}
          currentFilter={navFilter}
          onSelectFilter={(f) => setNavFilter(f)}
          selectedBucket={selectedBucket}
          onSelectBucket={(b) => setSelectedBucket(b)}
          buckets={allBuckets}
          counts={navCounts}
          onTaskClick={handleTaskClick}
          onToggleStatus={handleToggleStatus}
          onDragStart={handleDragStart}
          onDropToUnscheduled={handleDropToUnscheduled}
          onOpenNewTaskModal={() => {
            setDefaultNewTaskDate(null);
            setIsNewTaskOpen(true);
          }}
          isCollapsed={isLeftSidebarCollapsed}
          onToggleCollapse={() => setIsLeftSidebarCollapsed((prev) => !prev)}
          activeTab={sidebarTab}
          onSelectTab={(tab) => setSidebarTab(tab)}
        />

        {/* Grade Principal do Calendário (Centro: Visão Semana / Mês) - Amplo e Centralizado */}
        <main className="flex-1 min-h-0 overflow-hidden relative bg-[#f8f9fa]/80 flex flex-col">
          {isLoadingTasks ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-3 shadow-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              </div>
              <p className="text-sm font-semibold text-zinc-800 mb-1">
                Carregando tarefas do Supabase...
              </p>
              <p className="text-xs text-zinc-400 max-w-sm">
                Buscando registros da tabela <code className="text-zinc-600 font-mono bg-zinc-100 px-1 py-0.5 rounded">tarefas</code> e sincronizando status em tempo real.
              </p>
            </div>
          ) : viewMode === 'week' ? (
            <WeeklyView
              weekDates={weekDates}
              tasks={displayedTasks}
              teamMembers={teamMembers}
              userRole={userRole}
              todayDate={todayDate}
              onTaskClick={handleTaskClick}
              onToggleStatus={handleToggleStatus}
              onDragStart={handleDragStart}
              onDropOnDate={handleDropOnDate}
              onQuickAddTask={handleQuickAddTask}
            />
          ) : (
            <MonthlyView
              monthCells={monthCells}
              tasks={displayedTasks}
              teamMembers={teamMembers}
              userRole={userRole}
              todayISO={todayISO}
              onTaskClick={handleTaskClick}
              onToggleStatus={handleToggleStatus}
              onDragStart={handleDragStart}
              onDropOnDate={handleDropOnDate}
              onQuickAddTask={handleQuickAddTask}
            />
          )}
        </main>
      </div>

      {/* 3. Modal Lateral de Detalhes da Ação (RBAC: Simplificada p/ Membro, Completa p/ Admin) */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedTask(null);
        }}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        teamMembers={teamMembers}
        currentUser={currentUser}
        userRole={userRole}
      />

      {/* 4. Modal de Nova Ação (Admin - com Construtor de Campos Customizados) */}
      <NewTaskModal
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        onCreateTask={handleCreateTask}
        teamMembers={teamMembers}
        defaultScheduledDate={defaultNewTaskDate}
      />

      {/* 5. Modal de Preenchimento de Formulário Obrigatório ao Concluir Tarefa */}
      <TaskCompletionModal
        isOpen={isCompletionModalOpen}
        task={completingTask}
        onClose={() => {
          setIsCompletionModalOpen(false);
          setCompletingTask(null);
        }}
        onConfirmComplete={handleConfirmCompletion}
      />

      {/* 6. Notificação Toast de Feedback para Recorrência e Conclusão */}
      {toastMessage && (
        <div
          id="planner-toast-notification"
          className="fixed bottom-5 right-5 z-50 bg-zinc-900/95 text-white px-4 py-3 rounded-xl shadow-2xl border border-zinc-700/60 flex items-center gap-3 text-xs backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span className="font-medium pr-2 text-zinc-100">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer text-sm ml-auto p-1 leading-none"
            aria-label="Fechar notificação"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
