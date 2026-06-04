import { create } from 'zustand';
import type { User, PengajarTPA } from '../types';
import { supabase } from '../lib/supabase';

interface UserState {
  users: User[];
  userTPAs: PengajarTPA[];
  loading: boolean;
  init: () => Promise<void>;
  loadUserTPAs: (userId: string) => Promise<void>;
  assignTPA: (userId: string, tpaId: string) => Promise<boolean>;
  unassignTPA: (userId: string, tpaId: string) => Promise<boolean>;
  toggleActive: (userId: string) => Promise<boolean>;
}

export const useUsersStore = create<UserState>((set) => ({
  users: [] as User[],
  userTPAs: [] as PengajarTPA[],
  loading: false,

  init: async () => {
    set({ loading: true });
    let data: Record<string, unknown>[] | null = null;
    let error: unknown = null;

    const rpc = await supabase.rpc('get_all_users');
    if (!rpc.error && rpc.data) {
      data = rpc.data as Record<string, unknown>[];
    } else {
      const q = await supabase.from('users').select('id, email, name, role, nim, is_active');
      data = q.data as Record<string, unknown>[] | null;
      error = q.error;
    }

    if (!error && data) {
      const mapped = data.map((row) => ({
        id: row.id as string,
        email: row.email as string,
        name: row.name as string,
        role: row.role as 'pengajar' | 'pengurus',
        nim: (row.nim as string) ?? undefined,
        isActive: (row.is_active as boolean) ?? true,
      })) as User[];
      set({ users: mapped, loading: false });
    } else {
      if (error) console.error('userStore.init error:', error);
      set({ loading: false });
    }
  },

  loadUserTPAs: async (userId: string) => {
    const { data, error } = await supabase.rpc('get_pengajar_tpas', { p_user_id: userId });
    if (!error && data) {
      const rows = data as { tpa_id: string; tpa_name: string }[];
      set({
        userTPAs: rows.map((r) => ({ userId, tpaId: r.tpa_id, tpaName: r.tpa_name })),
      });
    }
  },

  assignTPA: async (userId: string, tpaId: string): Promise<boolean> => {
    const { error } = await supabase.rpc('assign_pengajar_to_tpa', {
      p_user_id: userId,
      p_tpa_id: tpaId,
    });
    if (error) return false;
    set((state) => ({
      userTPAs: [...state.userTPAs.filter((t) => t.tpaId !== tpaId), { userId, tpaId }],
    }));
    return true;
  },

  unassignTPA: async (userId: string, tpaId: string): Promise<boolean> => {
    const { error } = await supabase.rpc('unassign_pengajar_from_tpa', {
      p_user_id: userId,
      p_tpa_id: tpaId,
    });
    if (error) return false;
    set((state) => ({
      userTPAs: state.userTPAs.filter((t) => t.tpaId !== tpaId),
    }));
    return true;
  },

  toggleActive: async (userId: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('toggle_user_active', {
      p_user_id: userId,
    });
    if (error || data === null) return false;
    set((state) => ({
      users: state.users.map((u) =>
        u.id === userId ? { ...u, isActive: data as boolean } : u,
      ),
    }));
    return true;
  },
}));

export function getUserById(id: string): User | undefined {
  return useUsersStore.getState().users.find((u) => u.id === id);
}
