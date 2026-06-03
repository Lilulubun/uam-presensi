import { create } from 'zustand';
import type { User } from '../types';
import { supabase } from '../lib/supabase';

interface UserState {
  users: User[];
  loading: boolean;
  init: () => Promise<void>;
}

export const useUsersStore = create<UserState>((set) => ({
  users: [] as User[],
  loading: false,

  init: async () => {
    set({ loading: true });
    let data: any = null;
    let error: any = null;

    // Try SECURITY DEFINER RPC first; fall back to direct table query.
    const rpc = await supabase.rpc('get_all_users');
    if (!rpc.error && rpc.data) {
      data = rpc.data;
    } else {
      const q = await supabase.from('users').select('id, email, name, role, nim');
      data = q.data;
      error = q.error;
    }

    if (!error && data) {
      const mapped = data.map((row: any) => ({
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        nim: row.nim ?? undefined,
      })) as User[];
      set({ users: mapped, loading: false });
    } else {
      set({ loading: false });
    }
  },
}));

export function getUserById(id: string): User | undefined {
  return useUsersStore.getState().users.find((u) => u.id === id);
}
