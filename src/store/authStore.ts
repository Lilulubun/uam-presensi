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

  login: async (identifier: string, password: string): Promise<ValidationResult> => {
    if (!identifier.includes('@')) {
      const { data: rows, error: nimError } = await supabase.rpc('get_emails_by_nim', {
        p_nim: identifier,
      });

      if (nimError) {
        return { valid: false, message: 'Gagal memverifikasi NIM. Hubungi admin.' };
      }
      if (!rows || rows.length === 0) {
        return { valid: false, message: 'NIM tidak ditemukan' };
      }

      // Multiple accounts may share this NIM — try each email
      for (const row of rows) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: row.email, password });
        if (error || !data.user) continue;
        const profile = await fetchProfile();
        if (!profile) {
          await supabase.auth.signOut();
          continue;
        }
        if (profile.isActive === false) {
          await supabase.auth.signOut();
          return { valid: false, message: 'Akun Anda telah dinonaktifkan. Hubungi admin.' };
        }
        set({ user: profile, isAuthenticated: true });
        return { valid: true, message: 'Login berhasil', data: profile };
      }
      return { valid: false, message: 'NIM atau password salah' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email: identifier, password });
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
