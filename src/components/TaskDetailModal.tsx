import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  Tag,
  Repeat,
  AlertCircle,
  Folder,
  Send,
  Trash2,
  CheckCircle2,
  Circle,
  MessageSquare,
  ShieldCheck,
  Plus,
  Sliders,
  Check,
  Lock,
} from 'lucide-react';
import {
  Task,
  TeamMember,
  UserRole,
  Priority,
  Recurrence,
  TaskStatus,
  CustomFormField,
  CustomFieldValue,
  TagBucket,
} from '../types.ts';
import { BUCKET_OPTIONS } from '../data/mockData.ts';

const WEEK_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateTask: (updated: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenCompletionModal?: (task: Task) => void;
  teamMembers: TeamMember[];
  currentUser: TeamMember;
  userRole: UserRole;
  buckets?: string[];
  tagBuckets?: TagBucket[];
}

export default function TaskDetailModal({
  task,
  isOpen,
  onClose,
  onUpdateTask,
  onDeleteTask,
  onOpenCompletionModal,
  teamMembers,
  currentUser,
  userRole,
  buckets = BUCKET_OPTIONS,
  tagBuckets = [],
}: TaskDetailModalProps) {
  if (!isOpen || !task) return null;

  const isAdmin = userRole === 'admin';
  const [newCommentText, setNewCommentText] = useState('');
  const [newTagInput, setNewTagInput] = useState('');

  // Estados para edição de campos customizados pelo admin
  const [isAddingField, setIsAddingField] = useState(false);
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<'number' | 'text'>('number');
  const [fieldRequired, setFieldRequired] = useState(true);

  // Valores preenchidos pelo membro na visualização simplificada
  const [memberFormValues, setMemberFormValues] = useState<Record<string, string | number>>(() => {
    const map: Record<string, string | number> = {};
    task.customFields?.forEach((f) => {
      const existing = task.customFieldValues?.find((v) => v.fieldId === f.id);
      map[f.id] = existing !== undefined ? existing.value : '';
    });
    return map;
  });
  const [completionError, setCompletionError] = useState<string | null>(null);

  const handleStatusChange = (status: TaskStatus) => {
    if (status === 'concluida') {
      // Verificar se há campos obrigatórios não preenchidos
      const missing: string[] = [];
      const filled: CustomFieldValue[] = [];

      task.customFields?.forEach((field) => {
        const val = memberFormValues[field.id];
        if (field.required && (val === undefined || val === null || val === '')) {
          missing.push(field.label);
        }
        if (val !== undefined && val !== null && val !== '') {
          filled.push({ fieldId: field.id, value: val });
        }
      });

      if (missing.length > 0) {
        setCompletionError(
          `Preenchimento obrigatório para concluir: ${missing.join(', ')}.`
        );
        return;
      }

      setCompletionError(null);
      onUpdateTask({
        ...task,
        status: 'concluida',
        customFieldValues: filled,
      });
    } else {
      setCompletionError(null);
      onUpdateTask({ ...task, status });
    }
  };

  const handleMemberInputChange = (fieldId: string, val: string, type: 'number' | 'text') => {
    setCompletionError(null);
    const parsed = type === 'number' ? (val === '' ? '' : Number(val)) : val;
    setMemberFormValues((prev) => ({ ...prev, [fieldId]: parsed }));

    // Atualizar no objeto da tarefa os valores preenchidos em tempo real
    const newFilled: CustomFieldValue[] = [];
    task.customFields?.forEach((f) => {
      const v = f.id === fieldId ? parsed : memberFormValues[f.id];
      if (v !== undefined && v !== null && v !== '') {
        newFilled.push({ fieldId: f.id, value: v });
      }
    });

    onUpdateTask({
      ...task,
      customFieldValues: newFilled,
    });
  };

  const handleFieldChange = (field: keyof Task, value: any) => {
    if (!isAdmin && field !== 'status') return;
    onUpdateTask({ ...task, [field]: value });
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const newComment = {
      id: `c-${Date.now()}`,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorInitials: currentUser.initials,
      authorColor: currentUser.avatarColor,
      text: newCommentText.trim(),
      createdAt: new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    onUpdateTask({
      ...task,
      comments: [...(task.comments || []), newComment],
    });
    setNewCommentText('');
  };

  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    const cleanTag = newTagInput.trim();
    if (!task.tags.includes(cleanTag)) {
      onUpdateTask({ ...task, tags: [...task.tags, cleanTag] });
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!isAdmin) return;
    onUpdateTask({
      ...task,
      tags: task.tags.filter((t) => t !== tagToRemove),
    });
  };

  const handleAddAdminCustomField = () => {
    if (!fieldLabel.trim()) return;
    const newField: CustomFormField = {
      id: `field-${Date.now()}`,
      label: fieldLabel.trim(),
      type: fieldType,
      required: fieldRequired,
    };
    onUpdateTask({
      ...task,
      customFields: [...(task.customFields || []), newField],
    });
    setFieldLabel('');
    setIsAddingField(false);
  };

  const handleRemoveAdminCustomField = (fieldId: string) => {
    if (!isAdmin) return;
    onUpdateTask({
      ...task,
      customFields: task.customFields?.filter((f) => f.id !== fieldId),
      customFieldValues: task.customFieldValues?.filter((v) => v.fieldId !== fieldId),
    });
  };

  // Helper para cor de prioridade
  const getPriorityStyle = (p: Priority) => {
    switch (p) {
      case 'Urgente':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Alta':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Média':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Baixa':
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div
      id="task-detail-backdrop"
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="task-detail-drawer"
        className={`bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-slideLeft transition-all ${
          isAdmin ? 'w-full max-w-2xl' : 'w-full max-w-md'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============================================================ */}
        {/* CASO 1: VISÃO DO USUÁRIO COMUM (SIMPLIFICADA) */}
        {/* ============================================================ */}
        {!isAdmin ? (
          <div className="flex flex-col h-full">
            {/* Cabeçalho Simplificado */}
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                  Visão de Membro
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo Focado do Membro: Status, Prioridade e Formulário Obrigatório */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Título da Ação */}
              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                  Ação
                </span>
                <h2 className="text-base font-bold text-gray-900 leading-snug">
                  {task.title}
                </h2>
                {task.description && (
                  <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-3 rounded-lg border border-gray-100 leading-relaxed">
                    {task.description}
                  </p>
                )}

                {/* Exibição dos Responsáveis Designados */}
                {(() => {
                  const assigneeIds = task.assignedToIds || (task.assignedTo ? [task.assignedTo] : []);
                  const assignedMembers = teamMembers.filter((m) => assigneeIds.includes(m.id));
                  if (assignedMembers.length === 0) return null;

                  return (
                    <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                        Responsáveis Designados ({assignedMembers.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {assignedMembers.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white border border-slate-200 shadow-2xs text-xs font-semibold text-slate-800"
                          >
                            <div
                              className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                              style={{ backgroundColor: m.color || '#004691' }}
                            >
                              {m.avatar || m.name.charAt(0)}
                            </div>
                            <span className="text-xs">{m.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Bloco de Status e Prioridade (Os únicos dois parâmetros exibidos) */}
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-gray-50/90 rounded-xl border border-gray-200">
                {/* 1. Status */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">
                    Status da Ação
                  </label>
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                    className={`w-full text-xs font-semibold rounded-lg px-2.5 py-2 border outline-none cursor-pointer ${
                      task.status === 'concluida'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : task.status === 'em_andamento'
                        ? 'bg-blue-50 text-blue-800 border-blue-300'
                        : 'bg-white text-gray-800 border-gray-300'
                    }`}
                  >
                    <option value="pendente">⏳ Pendente</option>
                    <option value="em_andamento">⚡ Em Andamento</option>
                    <option value="concluida">✅ Concluída</option>
                  </select>
                </div>

                {/* 2. Prioridade (Visualização apenas) */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">
                    Prioridade
                  </label>
                  <div
                    className={`w-full text-xs font-semibold px-2.5 py-2 rounded-lg border text-center ${getPriorityStyle(
                      task.priority
                    )}`}
                  >
                    {task.priority}
                  </div>
                </div>
              </div>

              {/* Mensagem de Erro de Validação ao tentar concluir */}
              {completionError && (
                <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{completionError}</span>
                </div>
              )}

              {/* Formulário de Campos Customizados Obrigatórios (se houver) */}
              {task.customFields && task.customFields.length > 0 && (
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-blue-700" />
                    <h3 className="text-xs font-bold text-gray-900">
                      Métricas & Campos Obrigatórios para Conclusão
                    </h3>
                  </div>
                  <p className="text-[11px] text-gray-600">
                    O administrador definiu os campos abaixo. Preencha-os para que seja possível marcar a ação como <strong>Concluída</strong>.
                  </p>

                  <div className="space-y-3 pt-1">
                    {task.customFields.map((field) => {
                      const currentVal =
                        memberFormValues[field.id] !== undefined
                          ? memberFormValues[field.id]
                          : '';

                      return (
                        <div key={field.id} className="space-y-1">
                          <label className="block text-xs font-semibold text-gray-700">
                            {field.label}{' '}
                            {field.required && (
                              <span className="text-red-500 font-bold">*</span>
                            )}
                          </label>
                          <input
                            type={field.type === 'number' ? 'number' : 'text'}
                            required={field.required}
                            placeholder={
                              field.placeholder ||
                              (field.type === 'number' ? '0' : 'Preencha aqui...')
                            }
                            value={currentVal}
                            onChange={(e) =>
                              handleMemberInputChange(field.id, e.target.value, field.type)
                            }
                            className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 bg-white"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé Simplificado */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="text-[11px] text-gray-500">
                Alterações de status são salvas automaticamente.
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* CASO 2: VISÃO DO ADMINISTRADOR (ACESSO COMPLETO) */
          /* ============================================================ */
          <div className="flex flex-col h-full">
            {/* Cabeçalho do Drawer Admin */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                    task.status === 'concluida'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : task.status === 'em_andamento'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  {task.status === 'concluida'
                    ? 'Concluída'
                    : task.status === 'em_andamento'
                    ? 'Em Andamento'
                    : 'Pendente'}
                </span>

                <span className="inline-flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium border border-blue-100">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Modo Administrador</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Tem certeza que deseja excluir esta ação?')) {
                      onDeleteTask(task.id);
                      onClose();
                    }
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  title="Excluir ação"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Corpo com Scroll do Admin */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Título da Ação */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  Nome da Ação
                </label>
                <input
                  type="text"
                  value={task.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  className="w-full text-lg font-bold text-gray-900 border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  Descrição detalhada
                </label>
                <textarea
                  rows={3}
                  value={task.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  placeholder="Adicione detalhes, critérios de aceitação e instruções..."
                  className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
                />
              </div>

              {/* Grid de Atributos Estruturais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50/70 p-4 rounded-xl border border-gray-200">
                {/* Status */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Status da Tarefa
                  </label>
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                    className="w-full text-xs font-medium bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-600"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="em_andamento">Em Andamento</option>
                    <option value="concluida">Concluída</option>
                  </select>
                </div>

                {/* Prioridade */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Prioridade
                  </label>
                  <select
                    value={task.priority}
                    onChange={(e) => handleFieldChange('priority', e.target.value as Priority)}
                    className="w-full text-xs font-medium bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-600"
                  >
                    <option value="Urgente">Urgente</option>
                    <option value="Alta">Alta</option>
                    <option value="Média">Média</option>
                    <option value="Baixa">Baixa</option>
                  </select>
                </div>

                {/* Recorrência */}
                <div className={task.recurrence === 'Personalizado' ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Recorrência
                  </label>
                  <select
                    value={task.recurrence || 'Nenhuma'}
                    onChange={(e) => {
                      const val = e.target.value as Recurrence;
                      const currentDays = task.recurrenceDays && task.recurrenceDays.length > 0 ? task.recurrenceDays : ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
                      onUpdateTask({
                        ...task,
                        recurrence: val,
                        recurrenceDays: val === 'Personalizado' ? currentDays : task.recurrenceDays,
                      });
                    }}
                    className="w-full text-xs font-medium bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-600"
                  >
                    <option value="Nenhuma">Nenhuma (Única vez)</option>
                    <option value="Segunda a Sexta">Segunda a Sexta (Dias Úteis)</option>
                    <option value="Diariamente">Diariamente</option>
                    <option value="Semanalmente">Semanalmente</option>
                    <option value="Mensalmente">Mensalmente</option>
                    <option value="Personalizado">Personalizado</option>
                  </select>

                  {task.recurrence === 'Personalizado' && (
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-2 px-1">
                      {WEEK_DAYS.map((day) => {
                        const currentDays = task.recurrenceDays || [];
                        const isChecked = currentDays.includes(day);
                        return (
                          <label
                            key={day}
                            className="flex items-center gap-1.5 text-xs text-gray-800 font-medium cursor-pointer select-none hover:text-[#004691]"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                const newDays = isChecked
                                  ? currentDays.filter((d) => d !== day)
                                  : [...currentDays, day];
                                onUpdateTask({
                                  ...task,
                                  recurrenceDays: newDays,
                                });
                              }}
                              className="w-4 h-4 rounded border-gray-400 text-[#004691] focus:ring-[#004691] cursor-pointer accent-[#004691]"
                            />
                            <span>{day}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Bucket / Categoria */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Bucket / Categoria
                  </label>
                  <select
                    value={task.bucket}
                    onChange={(e) => handleFieldChange('bucket', e.target.value)}
                    className="w-full text-xs font-medium bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-600"
                  >
                    {buckets.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Atribuição de Múltiplos Responsáveis da Equipe */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-700">
                      Responsáveis da Equipe {(task.assignedToIds || (task.assignedTo ? [task.assignedTo] : [])).length > 0 && `(${ (task.assignedToIds || (task.assignedTo ? [task.assignedTo] : [])).length } atribuído${(task.assignedToIds || (task.assignedTo ? [task.assignedTo] : [])).length > 1 ? 's' : ''})`}
                    </label>
                    {(task.assignedToIds || (task.assignedTo ? [task.assignedTo] : [])).length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateTask({
                            ...task,
                            assignedTo: null,
                            assignedToIds: [],
                          });
                        }}
                        className="text-[11px] text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
                      >
                        Desmarcar todos
                      </button>
                    )}
                  </div>

                  <div className="p-2.5 bg-gray-50/80 border border-gray-200 rounded-lg max-h-40 overflow-y-auto space-y-1.5">
                    {teamMembers.map((m) => {
                      const currentAssignees = task.assignedToIds || (task.assignedTo ? [task.assignedTo] : []);
                      const isSelected = currentAssignees.includes(m.id);

                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            const newAssignees = isSelected
                              ? currentAssignees.filter((id) => id !== m.id)
                              : [...currentAssignees, m.id];
                            onUpdateTask({
                              ...task,
                              assignedTo: newAssignees[0] || null,
                              assignedToIds: newAssignees,
                            });
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 border border-blue-200 text-blue-900 font-semibold shadow-2xs'
                              : 'bg-white border border-gray-200/80 text-gray-700 hover:bg-gray-100/70'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-2xs"
                              style={{ backgroundColor: m.color || '#004691' }}
                            >
                              {m.avatar || m.name.charAt(0)}
                            </div>
                            <div className="truncate">
                              <span>{m.name}</span>
                              <span className="text-[10px] font-normal text-gray-500 ml-1.5">
                                ({m.role === 'admin' ? 'Admin' : 'Membro'}) - {m.email}
                              </span>
                            </div>
                          </div>

                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-[#004691] border-[#004691] text-white'
                                : 'border-gray-300 bg-white'
                            }`}
                          >
                            {isSelected && '✓'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Datas */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    value={task.startDate || ''}
                    onChange={(e) => handleFieldChange('startDate', e.target.value)}
                    className="w-full text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Data de Término
                  </label>
                  <input
                    type="date"
                    value={task.endDate || ''}
                    onChange={(e) => handleFieldChange('endDate', e.target.value)}
                    className="w-full text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-600"
                  />
                </div>

                {/* Data Agendada no Calendário */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-600">
                      Agendamento no Calendário
                    </label>
                    {task.scheduledDate && (
                      <button
                        type="button"
                        onClick={() => handleFieldChange('scheduledDate', null)}
                        className="text-[11px] text-amber-700 hover:underline cursor-pointer"
                      >
                        Mover para Fila Não Iniciadas
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={task.scheduledDate || ''}
                    onChange={(e) =>
                      handleFieldChange('scheduledDate', e.target.value || null)
                    }
                    className="w-full text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-600"
                  />
                  {!task.scheduledDate && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      Esta ação está na <strong>Fila de Tarefas Não Iniciadas</strong>.
                    </p>
                  )}
                </div>
              </div>

              {/* Seção: Configuração e Respostas dos Campos Customizáveis */}
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-blue-700" />
                    <h3 className="text-xs font-bold text-gray-900">
                      Campos de Formulário Customizáveis & Métricas
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingField(!isAddingField)}
                    className="text-xs text-blue-700 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAddingField ? 'Fechar' : 'Novo Campo'}</span>
                  </button>
                </div>

                {/* Form para adicionar novo campo */}
                {isAddingField && (
                  <div className="p-3 bg-white border border-blue-200 rounded-lg space-y-2">
                    <input
                      type="text"
                      placeholder="Nome do campo (ex: Ligações efetivas)"
                      value={fieldLabel}
                      onChange={(e) => setFieldLabel(e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 outline-none focus:border-blue-600"
                    />
                    <div className="flex items-center justify-between pt-1">
                      <select
                        value={fieldType}
                        onChange={(e) => setFieldType(e.target.value as 'number' | 'text')}
                        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                      >
                        <option value="number">Numérico</option>
                        <option value="text">Texto</option>
                      </select>

                      <label className="flex items-center gap-1 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fieldRequired}
                          onChange={(e) => setFieldRequired(e.target.checked)}
                          className="rounded text-blue-600"
                        />
                        <span>Obrigatório</span>
                      </label>

                      <button
                        type="button"
                        onClick={handleAddAdminCustomField}
                        disabled={!fieldLabel.trim()}
                        className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 cursor-pointer"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                )}

                {/* Lista de Campos com Respostas Registradas */}
                {task.customFields && task.customFields.length > 0 ? (
                  <div className="space-y-2">
                    {task.customFields.map((f) => {
                      const response = task.customFieldValues?.find((v) => v.fieldId === f.id);
                      return (
                        <div
                          key={f.id}
                          className="p-2.5 bg-white border border-gray-200 rounded-lg flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-800">{f.label}</span>
                              {f.required && (
                                <span className="text-[9px] bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.2 rounded font-bold">
                                  Obrigatório
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              Valor preenchido:{' '}
                              {response !== undefined && response.value !== '' ? (
                                <strong className="text-gray-900 font-bold">
                                  {response.value}
                                </strong>
                              ) : (
                                <span className="italic text-gray-400">
                                  Ainda não preenchido pelo responsável
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveAdminCustomField(f.id)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                            title="Remover este campo da ação"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500 italic">
                    Nenhum campo de formulário configurado nesta ação.
                  </p>
                )}
              </div>

              {/* TAGs */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  TAGs da Ação
                </label>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {task.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 text-gray-800 text-xs font-medium border border-gray-200"
                    >
                      <Tag className="w-3 h-3 text-gray-400" />
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-gray-400 hover:text-red-600 ml-0.5 cursor-pointer"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>

                {/* Sugestões rápidas de tags cadastradas */}
                {tagBuckets.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 my-2">
                    <span className="text-[10px] text-zinc-400 mr-1">Sugestões:</span>
                    {tagBuckets.map((tb) => {
                      const isSelected = task.tags?.includes(tb.nome);
                      return (
                        <button
                          key={tb.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              handleRemoveTag(tb.nome);
                            } else {
                              const updatedTags = [...(task.tags || []), tb.nome];
                              handleFieldChange('tags', updatedTags);
                            }
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                          }`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: tb.cor || '#003067' }}
                          />
                          <span>{tb.nome}</span>
                          {isSelected && <span>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="Nova TAG (ex: Urgente, Q3, Cliente X)"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 flex-1 outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Chat Integrado da Equipe (Apenas Admin) */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    Histórico e Chat da Equipe ({task.comments?.length || 0})
                  </h3>
                </div>

                {/* Lista de Comentários */}
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-1">
                  {!task.comments || task.comments.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-gray-400 text-xs">
                      Nenhum comentário registrado ainda.
                    </div>
                  ) : (
                    task.comments.map((comm) => (
                      <div
                        key={comm.id}
                        className="bg-gray-50 rounded-lg p-3 border border-gray-100"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                comm.authorColor || 'bg-blue-600 text-white'
                              }`}
                            >
                              {comm.authorInitials || 'U'}
                            </div>
                            <span className="text-xs font-semibold text-gray-800">
                              {comm.authorName}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400">{comm.createdAt}</span>
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed pl-7 break-words">
                          {comm.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Input para Novo Comentário */}
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Escreva uma observação ou mensagem para o histórico..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-blue-600"
                  />
                  <button
                    type="submit"
                    disabled={!newCommentText.trim()}
                    className="px-4 py-2.5 bg-institucional text-white text-xs font-medium rounded-lg hover:opacity-95 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Rodapé do Drawer Admin */}
            <div className="px-6 py-3.5 border-t border-gray-200 bg-gray-50 flex items-center justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                Fechar Painel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
