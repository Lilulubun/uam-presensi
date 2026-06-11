import { create } from 'zustand';
import type { AuthState, User, ValidationResult } from '../types';
import { supabase } from '../lib/supabase';
import { toCamelCase } from '../lib/transform';

const INDONESIAN_AUTH_ERROR = 'Email atau password salah';

async function fetchProfile(): Promise<User | null> {
  const { data, error } = await supabase.rpc('get_profile');
  if (error || !data || data.length === 0) return null;
  return toCamelCase<User>(data[0]);
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,

  init: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      const profile = await fetchProfile();
      if (profile?.isActive === false) {
        await supabase.auth.signOut();
        set({ user: null, isAuthenticated: false, loading: false });
        return;
      }
      set({ user: profile, isAuthenticated: !!profile, loading: false });
    } else {
      set({ loading: false });
    }

    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        set({ user: null, isAuthenticated: false });
      }
    });
  },

  login: async (email: string, password: string): Promise<ValidationResult> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { valid: false, message: INDONESIAN_AUTH_ERROR };
    }
    const profile = await fetchProfile();
    if (!profile) {
      await supabase.auth.signOut();
      return { valid: false, message: 'Profil pengguna tidak ditemukan' };
    }
    if (profile.isActive === false) {
      await supabase.auth.signOut();
      return { valid: false, message: 'Akun Anda telah dinonaktifkan. Hubungi admin.' };
    }
    set({ user: profile, isAuthenticated: true });
    return { valid: true, message: 'Login berhasil', data: profile };
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, isAuthenticated: false });
  },
}));
