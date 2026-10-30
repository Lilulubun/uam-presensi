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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  loading: true,
  recoveryUserId: null,

  init: async () => {
    const { data } = await supabase.auth.getSession();
    if (get().recoveryUserId) {
      set({ loading: false });
      return;
    }
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
  },

  recoverPassword: async (password) => {
    const recoveryUserId = get().recoveryUserId;
    if (!recoveryUserId || password.length < 8) {
      return { valid: false, message: 'Sesi pemulihan tidak valid atau password kurang dari 8 karakter.' };
    }
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || get().recoveryUserId !== recoveryUserId || data.session?.user.id !== recoveryUserId || !data.session.expires_at || data.session.expires_at * 1000 <= Date.now()) {
        set({ recoveryUserId: null });
        return { valid: false, message: 'Tautan pemulihan tidak valid atau kedaluwarsa. Minta tautan baru.' };
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) return { valid: false, message: 'Gagal menyimpan password. Coba lagi atau minta tautan pemulihan baru.' };
      set({ recoveryUserId: null });
      return { valid: true, message: 'Password berhasil diubah. Silakan masuk dengan password baru.' };
    } catch {
      return { valid: false, message: 'Gagal menyimpan password. Coba lagi.' };
    }
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

// Subscribe at module load, before SDK URL initialization can emit recovery.
// Keep callback synchronous: auth requests here can deadlock the SDK lock.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY' && session?.user && session.expires_at && session.expires_at * 1000 > Date.now()) {
    useAuthStore.setState({ recoveryUserId: session.user.id, user: null, isAuthenticated: false });
  } else if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
    useAuthStore.setState({ recoveryUserId: null, ...(event === 'SIGNED_OUT' ? { user: null, isAuthenticated: false } : {}) });
  }
});
