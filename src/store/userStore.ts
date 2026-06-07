import { create } from 'zustand';
import type { User, PengajarTPA } from '../types';
import { supabase } from '../lib/supabase';

interface UserState {
  users: User[];
  userTPAs: PengajarTPA[];
  pengajarByTPA: Record<string, User[]>;
  loading: boolean;
  init: () => Promise<void>;
  loadUserTPAs: (userId: string) => Promise<void>;
  fetchPengajarByTPA: (tpaId: string) => Promise<User[]>;
  assignTPA: (userId: string, tpaId: string) => Promise<boolean>;
  unassignTPA: (userId: string, tpaId: string) => Promise<boolean>;
  toggleActive: (userId: string) => Promise<boolean>;
  deletePengajar: (userId: string) => Promise<boolean>;
}

export const useUsersStore = create<UserState>((set) => ({
  users: [] as User[],
  userTPAs: [] as PengajarTPA[],
  pengajarByTPA: {} as Record<string, User[]>,
  loading: false,

  init: async () => {
    set({ loading: true });
    const { data, error } = await supabase.from('users').select('id, email, name, role, nim, is_active');

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

  fetchPengajarByTPA: async (tpaId: string): Promise<User[]> => {
    const { data, error } = await supabase.rpc('get_pengajar_by_tpa', { p_tpa_id: tpaId });
    if (error) {
      console.error('userStore.fetchPengajarByTPA error:', error);
      return [];
    }
    const rows = data as { user_id: string; name: string; email: string; nim: string }[];
    const users: User[] = rows.map((r) => ({
      id: r.user_id,
      name: r.name,
      email: r.email,
      role: 'pengajar' as const,
      nim: r.nim || undefined,
    }));
    set((state) => ({
      pengajarByTPA: { ...state.pengajarByTPA, [tpaId]: users },
    }));
    return users;
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

  deletePengajar: async (userId: string): Promise<boolean> => {
    const { error } = await supabase.rpc('delete_pengajar', {
      p_user_id: userId,
    });
    if (error) {
      console.error('deletePengajar error:', error);
      return false;
    }
    set((state) => ({
      users: state.users.filter((u) => u.id !== userId),
    }));
    return true;
  },
}));

export function getUserById(id: string): User | undefined {
  return useUsersStore.getState().users.find((u) => u.id === id);
}
