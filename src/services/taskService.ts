import { supabase } from '../supabase.js';
import { Task, Priority, Recurrence, TaskStatus, CustomFormField, CustomFieldValue, TaskComment } from '../types.ts';
import { getNextRecurrenceDate } from '../utils/dateUtils.ts';

function isValidUUID(val?: string | null): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
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

  const assignedToId = row.responsavel_id ?? row.assigned_to ?? row.assignedTo ?? null;

  return {
    id: String(row.id),
    title: row.titulo ?? row.title ?? 'Sem título',
    description: row.descricao ?? row.description ?? '',
    priority: (row.prioridade ?? row.priority ?? 'Alta') as Priority,
    recurrence: (row.recorrencia ?? row.recurrence ?? 'Nenhuma') as Recurrence,
    tags,
    assignedTo: assignedToId ? String(assignedToId) : null,
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

  if (task.assignedTo !== undefined) {
    if (task.assignedTo && isValidUUID(task.assignedTo)) {
      payload.responsavel_id = task.assignedTo;
    } else if (task.assignedTo && !task.assignedTo.startsWith('user-')) {
      payload.responsavel_id = task.assignedTo;
    } else {
      payload.responsavel_id = null;
    }
  }

  if (task.startDate !== undefined) payload.data_inicio = task.startDate || null;
  if (task.endDate !== undefined) payload.data_fim = task.endDate || null;
  if (task.scheduledDate !== undefined) payload.data_agendada = task.scheduledDate || null;
  if (task.status !== undefined) payload.status = task.status;
  if (task.tags !== undefined) payload.tags = task.tags;

  // Armazena definições de campos e valores preenchidos na coluna JSONB campos_customizados
  if (task.customFields !== undefined || task.customFieldValues !== undefined) {
    payload.campos_customizados = {
      fields: task.customFields || [],
      values: task.customFieldValues || [],
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
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  },

  /**
   * Atualiza o status da tarefa e campos customizados preenchidos.
   * Se a tarefa for concluída e possuir recorrência, insere a próxima ocorrência automaticamente no Supabase.
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
      // 1. Atualizar registro atual no Supabase
      const payload: Record<string, any> = {
        status: newStatus,
        campos_customizados: {
          fields: task.customFields || [],
          values: updatedValues,
        },
      };

      const { error } = await supabase
        .from('tarefas')
        .update(payload)
        .eq('id', task.id);

      if (error) {
        updateError = error;
      }

      // 2. Se a tarefa foi concluída e tem recorrência configurada e data agendada
      if (
        newStatus === 'concluida' &&
        task.recurrence &&
        task.recurrence !== 'Nenhuma' &&
        task.scheduledDate
      ) {
        const nextDate = getNextRecurrenceDate(task.scheduledDate, task.recurrence);

        if (nextDate) {
          const recurrentPayload = mapTaskToDbPayload({
            title: task.title,
            description: task.description,
            priority: task.priority,
            recurrence: task.recurrence,
            bucket: task.bucket,
            assignedTo: task.assignedTo,
            startDate: nextDate,
            endDate: nextDate,
            scheduledDate: nextDate,
            status: 'pendente',
            tags: task.tags,
            customFields: task.customFields || [],
            customFieldValues: [], // Resetar valores preenchidos para a nova ocorrência
          });

          // Inserir nova ocorrência no Supabase
          const { data: recurrentData, error: recurrentError } = await supabase
            .from('tarefas')
            .insert([recurrentPayload])
            .select();

          if (!recurrentError && recurrentData && recurrentData.length > 0) {
            nextRecurrentTask = mapDbRowToTask(recurrentData[0]);
          }
        }
      }

      return {
        updatedTask,
        nextRecurrentTask,
        error: updateError,
      };
    } catch (err) {
      return {
        updatedTask,
        nextRecurrentTask: null,
        error: err,
      };
    }
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
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  },
};

