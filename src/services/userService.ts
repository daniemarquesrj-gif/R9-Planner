import { supabase } from '../supabase.js';

export interface UserProfile {
  id: string;
  nome: string;
  email: string;
  funcao: 'admin' | 'membro';
  avatarColor: string;
  initials: string;
  createdAt?: string;
}

const AVATAR_COLORS = [
  'bg-blue-600 text-white',
  'bg-emerald-600 text-white',
  'bg-violet-600 text-white',
  'bg-amber-600 text-white',
  'bg-rose-600 text-white',
  'bg-cyan-600 text-white',
  'bg-indigo-600 text-white',
  'bg-teal-600 text-white',
];

export function getInitials(name: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Converte um registro da tabela 'perfis' do Supabase para o modelo UserProfile
 */
export function mapDbRowToProfile(row: any, index = 0): UserProfile {
  const rawFuncao = (row.funcao ?? row.role ?? 'membro').toString().toLowerCase();
  const funcao: 'admin' | 'membro' =
    rawFuncao === 'admin' || rawFuncao === 'administrador' ? 'admin' : 'membro';

  const nome = row.nome ?? row.name ?? row.full_name ?? (row.email ? row.email.split('@')[0] : 'Usuário');
  const email = row.email ?? '';
  const avatarColor =
    row.avatar_color ??
    row.avatarColor ??
    AVATAR_COLORS[Math.abs(index) % AVATAR_COLORS.length];

  return {
    id: String(row.id),
    nome,
    email,
    funcao,
    avatarColor,
    initials: getInitials(nome),
    createdAt: row.created_at ?? row.createdAt,
  };
}

export const userService = {
  /**
   * Busca estritamente todos os perfis reais da tabela 'perfis' no Supabase
   */
  async fetchProfiles(): Promise<{ data: UserProfile[]; error: any | null }> {
    try {
      const { data, error } = await supabase
        .from('perfis')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        return { data: [], error };
      }

      if (!data || data.length === 0) {
        return { data: [], error: null };
      }

      const profiles = data.map((row, idx) => mapDbRowToProfile(row, idx));
      return { data: profiles, error: null };
    } catch (err) {
      return { data: [], error: err };
    }
  },

  /**
   * Atualiza a função/cargo do usuário na tabela 'perfis' no Supabase
   */
  async updateUserRole(
    userId: string,
    newRole: 'admin' | 'membro'
  ): Promise<{ error: any | null }> {
    try {
      const { error } = await supabase
        .from('perfis')
        .update({ funcao: newRole })
        .eq('id', userId);

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (err) {
      return { error: err };
    }
  },
};

