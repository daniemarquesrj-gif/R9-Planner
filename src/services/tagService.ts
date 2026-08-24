import { supabase } from '../supabase.js';
import { TagBucket } from '../types.ts';

// Cores predefinidas para categorias/tags no padrão R9 Precision System
export const PRESET_TAG_COLORS = [
  { label: 'Azul R9', value: '#004691', bg: 'bg-[#004691]', text: 'text-white' },
  { label: 'Navy Escuro', value: '#003067', bg: 'bg-[#003067]', text: 'text-white' },
  { label: 'Ciano Corporativo', value: '#0284c7', bg: 'bg-[#0284c7]', text: 'text-white' },
  { label: 'Esmeralda', value: '#059669', bg: 'bg-[#059669]', text: 'text-white' },
  { label: 'Verde Floresta', value: '#15803d', bg: 'bg-[#15803d]', text: 'text-white' },
  { label: 'Âmbar Dourado', value: '#d97706', bg: 'bg-[#d97706]', text: 'text-white' },
  { label: 'Laranja Quente', value: '#ea580c', bg: 'bg-[#ea580c]', text: 'text-white' },
  { label: 'Rubi / Urgente', value: '#e11d48', bg: 'bg-[#e11d48]', text: 'text-white' },
  { label: 'Púrpura Executivo', value: '#7c3aed', bg: 'bg-[#7c3aed]', text: 'text-white' },
  { label: 'Grafite Neutro', value: '#475569', bg: 'bg-[#475569]', text: 'text-white' },
];

/**
 * Normaliza uma linha retornada pelo Supabase para o tipo TagBucket
 */
export function mapDbRowToTag(row: any): TagBucket {
  return {
    id: String(row.id),
    nome: row.nome ?? row.name ?? row.tag ?? row.bucket ?? row.titulo ?? 'Sem categoria',
    cor: row.cor ?? row.color ?? '#004691',
    descricao: row.descricao ?? row.description ?? '',
    created_at: row.created_at ?? row.createdAt,
  };
}

export const tagService = {
  /**
   * Busca todas as tags/categorias da tabela 'tags_bucket' no Supabase
   */
  async fetchTags(): Promise<{ data: TagBucket[]; error: any | null }> {
    try {
      const { data, error } = await supabase
        .from('tags_bucket')
        .select('*')
        .order('nome', { ascending: true });

      if (error) {
        // Tenta fallback com order por 'name' ou 'created_at' caso 'nome' gere erro de coluna
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('tags_bucket')
          .select('*');

        if (fallbackError) {
          console.warn('Erro ao consultar tags_bucket:', fallbackError);
          return { data: [], error: fallbackError };
        }

        const tags = (fallbackData || []).map(mapDbRowToTag);
        return { data: tags, error: null };
      }

      const tags = (data || []).map(mapDbRowToTag);
      return { data: tags, error: null };
    } catch (err) {
      console.error('Erro de conexão ao buscar tags_bucket:', err);
      return { data: [], error: err };
    }
  },

  /**
   * Cria uma nova tag/categoria na tabela 'tags_bucket'
   */
  async createTag(payload: {
    nome: string;
    cor?: string;
    descricao?: string;
  }): Promise<{ data: TagBucket | null; error: any | null }> {
    try {
      const cleanNome = payload.nome.trim();
      const insertPayload: Record<string, any> = {
        nome: cleanNome,
        cor: payload.cor || '#004691',
      };

      if (payload.descricao !== undefined) {
        insertPayload.descricao = payload.descricao.trim();
      }

      // Tenta inserir na tabela tags_bucket
      let { data, error } = await supabase
        .from('tags_bucket')
        .insert([insertPayload])
        .select();

      // Se falhar por nome de coluna incompatível (ex: se o banco estiver em inglês: name, color, description)
      if (error && (error.code === 'PGRST204' || error.message?.includes('column'))) {
        const altPayload: Record<string, any> = {
          name: cleanNome,
          color: payload.cor || '#004691',
          description: payload.descricao?.trim() || '',
        };
        const res = await supabase.from('tags_bucket').insert([altPayload]).select();
        data = res.data;
        error = res.error;
      }

      if (error) {
        return { data: null, error };
      }

      if (data && data.length > 0) {
        return { data: mapDbRowToTag(data[0]), error: null };
      }

      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  /**
   * Renomeia / Atualiza uma tag existente na tabela 'tags_bucket'
   */
  async updateTag(
    id: string,
    updates: { nome?: string; cor?: string; descricao?: string }
  ): Promise<{ data: TagBucket | null; error: any | null }> {
    try {
      const payload: Record<string, any> = {};
      if (updates.nome !== undefined) payload.nome = updates.nome.trim();
      if (updates.cor !== undefined) payload.cor = updates.cor;
      if (updates.descricao !== undefined) payload.descricao = updates.descricao.trim();

      let { data, error } = await supabase
        .from('tags_bucket')
        .update(payload)
        .eq('id', id)
        .select();

      if (error && (error.code === 'PGRST204' || error.message?.includes('column'))) {
        const altPayload: Record<string, any> = {};
        if (updates.nome !== undefined) altPayload.name = updates.nome.trim();
        if (updates.cor !== undefined) altPayload.color = updates.cor;
        if (updates.descricao !== undefined) altPayload.description = updates.descricao.trim();

        const res = await supabase
          .from('tags_bucket')
          .update(altPayload)
          .eq('id', id)
          .select();
        data = res.data;
        error = res.error;
      }

      if (error) {
        return { data: null, error };
      }

      if (data && data.length > 0) {
        return { data: mapDbRowToTag(data[0]), error: null };
      }

      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  /**
   * Exclui uma tag da tabela 'tags_bucket'
   */
  async deleteTag(id: string): Promise<{ error: any | null }> {
    try {
      const { error } = await supabase
        .from('tags_bucket')
        .delete()
        .eq('id', id);

      if (error) {
        return { error };
      }
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  },

  /**
   * Verifica quantas tarefas utilizam o nome desta tag/bucket no sistema
   */
  async countTasksWithTag(tagName: string): Promise<{ count: number; error: any | null }> {
    try {
      // 1. Busca por bucket
      const { count: bucketCount, error: bError } = await supabase
        .from('tarefas')
        .select('*', { count: 'exact', head: true })
        .eq('bucket', tagName);

      if (bError) {
        return { count: 0, error: bError };
      }

      return { count: bucketCount || 0, error: null };
    } catch (err) {
      return { count: 0, error: err };
    }
  },

  /**
   * Atualiza as tarefas que utilizavam a tag antiga para o novo nome renomeado
   */
  async renameTagInTasks(oldName: string, newName: string): Promise<{ updatedCount: number; error: any | null }> {
    try {
      const { data, error } = await supabase
        .from('tarefas')
        .update({ bucket: newName })
        .eq('bucket', oldName)
        .select();

      if (error) {
        return { updatedCount: 0, error };
      }

      return { updatedCount: data?.length || 0, error: null };
    } catch (err) {
      return { updatedCount: 0, error: err };
    }
  },

  /**
   * Remove ou reatribui a tag de tarefas quando a tag é deletada
   */
  async removeTagFromTasks(tagName: string, fallbackBucket = 'Geral'): Promise<{ error: any | null }> {
    try {
      const { error } = await supabase
        .from('tarefas')
        .update({ bucket: fallbackBucket })
        .eq('bucket', tagName);

      if (error) {
        return { error };
      }
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  },
};
