import { create } from 'zustand';
import type { AuthState, User, ValidationResult } from '../types';
import { supabase } from '../lib/supabase';

const INDONESIAN_AUTH_ERROR = 'Email atau password salah';

async function fetchProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data as User;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,

  init: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      const profile = await fetchProfile(data.session.user.id);
      set({ user: profile, isAuthenticated: !!profile, loading: false });
    } else {
      set({ loading: false });
    }
  },

  login: async (email: string, password: string): Promise<ValidationResult> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { valid: false, message: INDONESIAN_AUTH_ERROR };
    }
    const profile = await fetchProfile(data.user.id);
    if (!profile) {
      await supabase.auth.signOut();
      return { valid: false, message: 'Profil pengguna tidak ditemukan' };
    }
    set({ user: profile, isAuthenticated: true });
    return { valid: true, message: 'Login berhasil', data: profile };
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, isAuthenticated: false });
  },
}));
