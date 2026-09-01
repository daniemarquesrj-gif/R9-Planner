import { supabase } from '../supabase.js';
import { Task, Priority, Recurrence, TaskStatus, CustomFormField, CustomFieldValue, TaskComment, UserTaskSubmission } from '../types.ts';
import { getNextRecurrenceDate, formatISO } from '../utils/dateUtils.ts';

function isValidUUID(val?: string | null): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

// Canal global de broadcast para sincronização instantânea entre múltiplos usuários
let realtimeSyncChannel: any = null;

export function getTaskSyncChannel() {
  if (!realtimeSyncChannel) {
    realtimeSyncChannel = supabase.channel('tarefas-planner-sync-hub', {
      config: {
        broadcast: { ack: false, self: false },
      },
    });
    realtimeSyncChannel.subscribe();
  }
  return realtimeSyncChannel;
}

export function broadcastTaskMutation(
  action: 'created' | 'updated' | 'deleted' | 'form_submitted',
  taskOrId?: Task | string | null
) {
  try {
    const channel = getTaskSyncChannel();
    const payload = {
      action,
      taskId: typeof taskOrId === 'string' ? taskOrId : taskOrId?.id,
      task: typeof taskOrId === 'object' ? taskOrId : null,
      timestamp: Date.now(),
    };
    channel.send({
      type: 'broadcast',
      event: 'task_mutation',
      payload,
    });
  } catch (err) {
    console.warn('Erro ao emitir broadcast de sincronização de tarefa:', err);
  }
}

/**
 * Converte um registro do banco de dados Supabase (tabela 'tarefas')
 * para o modelo de dados Task utilizado no Planner.
 */
export function mapDbRowToTask(row: any): Task {
  // Extrair campos customizados e seus valores salvos no JSONB
  let customFields: CustomFormField[] = [];
  let customFieldValues: CustomFieldValue[] = [];

  const rawCustom = row.campos_customizados ?? row.custom_fields;
  if (rawCustom) {
    if (Array.isArray(rawCustom)) {
      customFields = rawCustom;
    } else if (typeof rawCustom === 'object') {
      if (Array.isArray(rawCustom.fields)) {
        customFields = rawCustom.fields;
      } else if (Array.isArray(rawCustom.customFields)) {
        customFields = rawCustom.customFields;
      }
      if (Array.isArray(rawCustom.values)) {
        customFieldValues = rawCustom.values;
      } else if (Array.isArray(rawCustom.customFieldValues)) {
        customFieldValues = rawCustom.customFieldValues;
      }
    }
  }

  // Fallback caso valores_customizados esteja em coluna separada
  if (row.valores_customizados && Array.isArray(row.valores_customizados)) {
    customFieldValues = row.valores_customizados;
  }

  // Comentários da ação
  let comments: TaskComment[] = [];
  const rawComments = row.comentarios ?? row.comments;
  if (Array.isArray(rawComments)) {
    comments = rawComments;
  }

  // Tags da ação
  let tags: string[] = [];
  if (Array.isArray(row.tags)) {
    tags = row.tags;
  } else if (typeof row.tags === 'string') {
    tags = row.tags
      ? row.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      : [];
  }

  // Responsáveis da ação (suporte robusto a múltiplos responsáveis com fallback retrocompatível)
  let assignedToIds: string[] = [];
  const rawAssignees =
    row.responsaveis_ids ??
    row.assigned_to_ids ??
    row.assignees ??
    (rawCustom && typeof rawCustom === 'object' && rawCustom.assigneeIds);

  if (Array.isArray(rawAssignees)) {
    assignedToIds = rawAssignees.map(String).filter(Boolean);
  } else if (typeof rawAssignees === 'string') {
    try {
      const parsed = JSON.parse(rawAssignees);
      if (Array.isArray(parsed)) {
        assignedToIds = parsed.map(String).filter(Boolean);
      } else {
        assignedToIds = rawAssignees.split(',').map((s) => s.trim()).filter(Boolean);
      }
    } catch {
      assignedToIds = rawAssignees.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }

  const assignedToId = row.responsavel_id ?? row.assigned_to ?? row.assignedTo ?? null;
  if (assignedToId && !assignedToIds.includes(String(assignedToId))) {
    assignedToIds.unshift(String(assignedToId));
  }

  const primaryAssignedTo = assignedToIds.length > 0 ? assignedToIds[0] : (assignedToId ? String(assignedToId) : null);

  // Dias da semana da recorrência personalizada
  let recurrenceDays: string[] = [];
  const rawRecurrenceDays =
    row.dias_recorrencia ??
    row.recurrence_days ??
    row.recurrenceDays ??
    (rawCustom && typeof rawCustom === 'object' && rawCustom.recurrenceDays);

  if (Array.isArray(rawRecurrenceDays)) {
    recurrenceDays = rawRecurrenceDays.map(String).filter(Boolean);
  } else if (typeof rawRecurrenceDays === 'string') {
    try {
      const parsed = JSON.parse(rawRecurrenceDays);
      if (Array.isArray(parsed)) {
        recurrenceDays = parsed.map(String).filter(Boolean);
      } else {
        recurrenceDays = rawRecurrenceDays.split(',').map((s) => s.trim()).filter(Boolean);
      }
    } catch {
      recurrenceDays = rawRecurrenceDays.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }

  // Submissões individuais por usuário (para tarefas compartilhadas com formulários)
  let userSubmissions: Record<string, UserTaskSubmission> = {};
  const rawSubmissions =
    row.submissoes_usuarios ??
    row.user_submissions ??
    row.userSubmissions ??
    (rawCustom && typeof rawCustom === 'object' && (rawCustom.userSubmissions || rawCustom.user_submissions));

  if (rawSubmissions && typeof rawSubmissions === 'object' && !Array.isArray(rawSubmissions)) {
    userSubmissions = rawSubmissions;
  } else if (Array.isArray(rawSubmissions)) {
    rawSubmissions.forEach((sub: any) => {
      if (sub && sub.userId) {
        userSubmissions[sub.userId] = sub;
      }
    });
  }

  return {
    id: String(row.id),
    title: row.titulo ?? row.title ?? 'Sem título',
    description: row.descricao ?? row.description ?? '',
    priority: (row.prioridade ?? row.priority ?? 'Alta') as Priority,
    recurrence: (row.recorrencia ?? row.recurrence ?? 'Nenhuma') as Recurrence,
    recurrenceDays,
    tags,
    assignedTo: primaryAssignedTo,
    assignedToIds,
    bucket: row.bucket ?? row.categoria ?? 'Operacional',
    startDate: row.data_inicio ?? row.start_date ?? row.startDate ?? undefined,
    endDate: row.data_fim ?? row.end_date ?? row.endDate ?? undefined,
    scheduledDate:
      row.data_agendada !== undefined
        ? row.data_agendada
        : row.scheduled_date !== undefined
        ? row.scheduled_date
        : row.scheduledDate ?? null,
    status: (row.status ?? 'pendente') as TaskStatus,
    comments,
    customFields,
    customFieldValues,
    userSubmissions,
  };
}

/**
 * Converte um objeto Task do frontend para a estrutura de colunas do Supabase
 */
export function mapTaskToDbPayload(
  task: Partial<Task> | Omit<Task, 'id' | 'comments'>
): Record<string, any> {
  const payload: Record<string, any> = {};

  if (task.title !== undefined) payload.titulo = task.title;
  if (task.description !== undefined) payload.descricao = task.description;
  if (task.priority !== undefined) payload.prioridade = task.priority;
  if (task.recurrence !== undefined) payload.recorrencia = task.recurrence;
  if (task.bucket !== undefined) payload.bucket = task.bucket;

  // Lista de múltiplos responsáveis
  const assignedToIds =
    task.assignedToIds !== undefined
      ? task.assignedToIds
      : task.assignedTo
      ? [task.assignedTo]
      : [];

  if (task.assignedTo !== undefined || task.assignedToIds !== undefined) {
    const primaryId = assignedToIds[0] || task.assignedTo || null;
    if (primaryId && isValidUUID(primaryId)) {
      payload.responsavel_id = primaryId;
    } else if (primaryId && !primaryId.startsWith('user-')) {
      payload.responsavel_id = primaryId;
    } else {
      payload.responsavel_id = null;
    }
  }

  if (task.startDate !== undefined) payload.data_inicio = task.startDate || null;
  if (task.endDate !== undefined) payload.data_fim = task.endDate || null;
  if (task.scheduledDate !== undefined) payload.data_agendada = task.scheduledDate || null;
  if (task.status !== undefined) payload.status = task.status;
  if (task.tags !== undefined) payload.tags = task.tags;

  // Armazena definições de campos, valores, array de responsáveis, dias de recorrência e submissões individuais no JSONB campos_customizados
  if (
    task.customFields !== undefined ||
    task.customFieldValues !== undefined ||
    task.assignedToIds !== undefined ||
    task.recurrenceDays !== undefined ||
    task.userSubmissions !== undefined
  ) {
    payload.campos_customizados = {
      fields: task.customFields || [],
      values: task.customFieldValues || [],
      assigneeIds: assignedToIds,
      recurrenceDays: task.recurrenceDays || [],
      userSubmissions: task.userSubmissions || {},
    };
  }

  if ('comments' in task && task.comments !== undefined) {
    payload.comentarios = task.comments || [];
  }

  return payload;
}

export const taskService = {
  /**
   * Busca estritamente todas as tarefas reais da tabela 'tarefas' no Supabase
   */
  async fetchTasks(): Promise<{ data: Task[]; error: any | null }> {
    try {
      const { data, error } = await supabase
        .from('tarefas')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return { data: [], error };
      }

      if (!data || data.length === 0) {
        return { data: [], error: null };
      }

      const parsedTasks = data.map(mapDbRowToTask);
      return { data: parsedTasks, error: null };
    } catch (err) {
      return { data: [], error: err };
    }
  },

  /**
   * Salva uma nova tarefa no Supabase (respeitando se vai para a Fila ou Calendário)
   */
  async createTask(
    newTaskData: Omit<Task, 'id' | 'comments'>
  ): Promise<{ data: Task | null; error: any | null }> {
    try {
      const payload = mapTaskToDbPayload(newTaskData);

      const { data, error } = await supabase
        .from('tarefas')
        .insert([payload])
        .select();

      if (error) {
        return { data: null, error };
      }

      if (data && data.length > 0) {
        const created = mapDbRowToTask(data[0]);
        broadcastTaskMutation('created', created);
        return { data: created, error: null };
      }

      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  /**
   * Atualiza a data agendada (Drag & Drop de/para Fila ou entre dias)
   */
  async updateScheduledDate(
    taskId: string,
    scheduledDate: string | null
  ): Promise<{ error: any | null }> {
    try {
      const { error } = await supabase
        .from('tarefas')
        .update({ data_agendada: scheduledDate })
        .eq('id', taskId);

      if (error) {
        return { error };
      }
      broadcastTaskMutation('updated', taskId);
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  },

  /**
   * Atualiza o status da tarefa e campos customizados preenchidos.
   * Quando o usuário marcar uma tarefa como 'concluida' com o campo recorrencia preenchido
   * (diferente de 'Nenhuma' ou null), calcula a próxima data válida e executa
   * supabase.from('tarefas').insert({...}) criando uma nova tarefa com status 'pendente'.
   */
  async updateTaskStatus(
    task: Task,
    newStatus: TaskStatus,
    filledValues?: CustomFieldValue[]
  ): Promise<{
    updatedTask: Task;
    nextRecurrentTask: Task | null;
    error: any | null;
  }> {
    const updatedValues =
      filledValues !== undefined ? filledValues : task.customFieldValues || [];

    const updatedTask: Task = {
      ...task,
      status: newStatus,
      customFieldValues: updatedValues,
    };

    let nextRecurrentTask: Task | null = null;
    let updateError: any = null;

    try {
      // 1. Atualizar registro atual no Supabase para o novo status
      const payload: Record<string, any> = {
        status: newStatus,
        campos_customizados: {
          fields: task.customFields || [],
          values: updatedValues,
          assigneeIds: task.assignedToIds || (task.assignedTo ? [task.assignedTo] : []),
          recurrenceDays: task.recurrenceDays || [],
          userSubmissions: task.userSubmissions || {},
        },
      };

      const { error } = await supabase
        .from('tarefas')
        .update(payload)
        .eq('id', task.id);

      if (error) {
        updateError = error;
      } else {
        broadcastTaskMutation('updated', updatedTask);
      }

      // 2. Verificação de Recorrência ao marcar como 'concluida'
      const hasRecurrence =
        task.recurrence &&
        task.recurrence !== 'Nenhuma' &&
        task.recurrence.trim() !== '';

      if (newStatus === 'concluida' && hasRecurrence) {
        // Base de cálculo: data_agendada atual (ou data_inicio / hoje)
        const baseDate = task.scheduledDate || task.startDate || formatISO(new Date());
        const nextDate = getNextRecurrenceDate(baseDate, task.recurrence, task.recurrenceDays);

        if (nextDate) {
          // Extrair a lista completa de múltiplos responsáveis para herança total
          const allAssigneeIds =
            task.assignedToIds && task.assignedToIds.length > 0
              ? [...task.assignedToIds]
              : task.assignedTo
              ? [task.assignedTo]
              : [];

          // Criação da Nova Instância no Supabase herdando todos os responsáveis
          const recurrentPayload = mapTaskToDbPayload({
            title: task.title,
            description: task.description || '',
            priority: task.priority || 'Alta',
            recurrence: task.recurrence,
            recurrenceDays: task.recurrenceDays || [],
            bucket: task.bucket || 'Operacional',
            assignedTo: allAssigneeIds[0] || null,
            assignedToIds: allAssigneeIds,
            startDate: nextDate,
            endDate: nextDate,
            scheduledDate: nextDate,
            status: 'pendente',
            tags: task.tags || [],
            customFields: task.customFields || [],
            customFieldValues: [], // Resetar valores preenchidos para a nova ocorrência
            userSubmissions: {}, // Iniciar submissões limpas para os mesmos responsáveis
            comments: [], // Iniciar sem comentários históricos
          });

          // Inserir nova tarefa no Supabase (status: 'pendente')
          const { data: recurrentData, error: recurrentError } = await supabase
            .from('tarefas')
            .insert([recurrentPayload])
            .select();

          if (!recurrentError && recurrentData && recurrentData.length > 0) {
            nextRecurrentTask = mapDbRowToTask(recurrentData[0]);
            broadcastTaskMutation('created', nextRecurrentTask);
          } else if (recurrentError) {
            console.error('Erro ao criar próxima instância recorrente no Supabase:', recurrentError);
          }
        }
      }

      return {
        updatedTask,
        nextRecurrentTask,
        error: updateError,
      };
    } catch (err) {
      console.error('Erro ao atualizar status da tarefa:', err);
      return {
        updatedTask,
        nextRecurrentTask: null,
        error: err,
      };
    }
  },

  /**
   * Conclui ou reabre a parte de um responsável específico em uma tarefa (Conclusão Parcial).
   * Atualiza a submissão no Supabase sem afetar os dados ou status dos outros membros atribuídos.
   * Se todos os membros atribuídos completarem, atualiza o status geral da tarefa para 'concluida'
   * e dispara a recorrência automática quando configurada.
   */
  async updateAssigneeCompletion(
    task: Task,
    memberId: string,
    completed: boolean,
    values?: Record<string, string | number>,
    memberName?: string,
    observacao?: string
  ): Promise<{
    updatedTask: Task;
    nextRecurrentTask: Task | null;
    error: any | null;
  }> {
    const assigneeIds =
      task.assignedToIds && task.assignedToIds.length > 0
        ? task.assignedToIds
        : task.assignedTo
        ? [task.assignedTo]
        : [memberId];

    const existingSub = task.userSubmissions?.[memberId] || {
      userId: memberId,
      userName: memberName || 'Usuário',
      completed: false,
      values: {},
    };

    const finalObservacao =
      observacao !== undefined
        ? observacao
        : existingSub.observacao !== undefined
        ? existingSub.observacao
        : existingSub.observation;

    const updatedSubmissions: Record<string, UserTaskSubmission> = {
      ...(task.userSubmissions || {}),
      [memberId]: {
        ...existingSub,
        userId: memberId,
        userName: memberName || existingSub.userName || 'Usuário',
        completed,
        completedAt: completed
          ? existingSub.completedAt || new Date().toISOString()
          : undefined,
        values: values !== undefined ? values : existingSub.values || {},
        observacao: finalObservacao,
        observation: finalObservacao,
      },
    };

    // Consolidar valores para customFieldValues
    const consolidatedValues: CustomFieldValue[] = [];
    if (task.customFields && task.customFields.length > 0) {
      task.customFields.forEach((f) => {
        let sum: number | string = 0;
        const isNum = f.type === 'number';
        let hasAny = false;

        Object.values(updatedSubmissions).forEach((s) => {
          if (s.values && s.values[f.id] !== undefined && s.values[f.id] !== '') {
            hasAny = true;
            if (isNum) {
              sum = Number(sum) + Number(s.values[f.id]);
            } else {
              sum = String(s.values[f.id]);
            }
          }
        });

        if (hasAny) {
          consolidatedValues.push({ fieldId: f.id, value: sum });
        }
      });
    }

    // Verificar se todos os responsáveis completaram
    const allCompleted = assigneeIds.every(
      (id) => updatedSubmissions[id]?.completed === true
    );
    const anyCompleted = assigneeIds.some(
      (id) => updatedSubmissions[id]?.completed === true
    );

    const newStatus: TaskStatus = allCompleted
      ? 'concluida'
      : anyCompleted
      ? 'em_andamento'
      : 'pendente';

    const updatedTask: Task = {
      ...task,
      status: newStatus,
      userSubmissions: updatedSubmissions,
      customFieldValues:
        consolidatedValues.length > 0
          ? consolidatedValues
          : task.customFieldValues,
    };

    let nextRecurrentTask: Task | null = null;
    let updateError: any = null;

    try {
      const payload: Record<string, any> = {
        status: newStatus,
        campos_customizados: {
          fields: task.customFields || [],
          values: updatedTask.customFieldValues || [],
          assigneeIds: task.assignedToIds || (task.assignedTo ? [task.assignedTo] : []),
          recurrenceDays: task.recurrenceDays || [],
          userSubmissions: updatedSubmissions,
        },
      };

      const { error } = await supabase
        .from('tarefas')
        .update(payload)
        .eq('id', task.id);

      if (error) {
        updateError = error;
      } else {
        broadcastTaskMutation('updated', updatedTask);
      }

      // Verificação de Recorrência se todos concluíram
      const hasRecurrence =
        task.recurrence &&
        task.recurrence !== 'Nenhuma' &&
        task.recurrence.trim() !== '';

      if (allCompleted && hasRecurrence) {
        const baseDate = task.scheduledDate || task.startDate || formatISO(new Date());
        const nextDate = getNextRecurrenceDate(baseDate, task.recurrence, task.recurrenceDays);

        if (nextDate) {
          const allAssigneeIds =
            task.assignedToIds && task.assignedToIds.length > 0
              ? [...task.assignedToIds]
              : task.assignedTo
              ? [task.assignedTo]
              : [];

          const recurrentPayload = mapTaskToDbPayload({
            title: task.title,
            description: task.description || '',
            priority: task.priority || 'Alta',
            recurrence: task.recurrence,
            recurrenceDays: task.recurrenceDays || [],
            bucket: task.bucket || 'Operacional',
            assignedTo: allAssigneeIds[0] || null,
            assignedToIds: allAssigneeIds,
            startDate: nextDate,
            endDate: nextDate,
            scheduledDate: nextDate,
            status: 'pendente',
            tags: task.tags || [],
            customFields: task.customFields || [],
            customFieldValues: [],
            userSubmissions: {},
            comments: [],
          });

          const { data: recurrentData, error: recurrentError } = await supabase
            .from('tarefas')
            .insert([recurrentPayload])
            .select();

          if (!recurrentError && recurrentData && recurrentData.length > 0) {
            nextRecurrentTask = mapDbRowToTask(recurrentData[0]);
            broadcastTaskMutation('created', nextRecurrentTask);
          } else if (recurrentError) {
            console.error('Erro ao criar próxima instância recorrente no Supabase:', recurrentError);
          }
        }
      }

      return {
        updatedTask,
        nextRecurrentTask,
        error: updateError,
      };
    } catch (err) {
      console.error('Erro ao atualizar conclusão individual do responsável:', err);
      return {
        updatedTask,
        nextRecurrentTask: null,
        error: err,
      };
    }
  },

  /**
   * Função explícita para marcar uma tarefa como 'concluida', aplicando preenchimento e gerando recorrência automática.
   */
  async completeTask(
    task: Task,
    filledValues?: CustomFieldValue[]
  ): Promise<{
    updatedTask: Task;
    nextRecurrentTask: Task | null;
    error: any | null;
  }> {
    return this.updateTaskStatus(task, 'concluida', filledValues);
  },

  /**
   * Atualização completa de uma tarefa (título, descrição, prioridade, comentários, etc.)
   */
  async updateTask(
    task: Task
  ): Promise<{ data: Task; error: any | null }> {
    try {
      const payload = mapTaskToDbPayload(task);

      const { error } = await supabase
        .from('tarefas')
        .update(payload)
        .eq('id', task.id);

      if (error) {
        return { data: task, error };
      }

      broadcastTaskMutation('updated', task);
      return { data: task, error: null };
    } catch (err) {
      return { data: task, error: err };
    }
  },

  /**
   * Remove uma tarefa do banco de dados Supabase
   */
  async deleteTask(taskId: string): Promise<{ error: any | null }> {
    try {
      const { error } = await supabase
        .from('tarefas')
        .delete()
        .eq('id', taskId);

      if (error) {
        return { error };
      }
      broadcastTaskMutation('deleted', taskId);
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  },
};

