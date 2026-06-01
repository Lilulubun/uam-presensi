import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthState, User, ValidationResult } from '../types';
import { MOCK_USERS } from '../lib/mock-data';
import { ENABLE_MOCK_AUTH } from '../config';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,

      login: async (
        email: string,
        password: string
      ): Promise<ValidationResult> => {
        // PROTOTYPE: Mock authentication with localStorage
        // PRODUCTION: Replace with Supabase Auth
        // const { data, error } = await supabase.auth.signInWithPassword({ email, password })

        if (!ENABLE_MOCK_AUTH) {
          return {
            valid: false,
            message: 'Mock auth is disabled',
          };
        }

        const user = MOCK_USERS.find(
          (u) => u.email === email && u.password === password
        );

        if (!user) {
          return {
            valid: false,
            message: 'Email atau password salah',
          };
        }

        // Remove password from user object before storing
        const { password: _, ...userWithoutPassword } = user;

        set({
          user: userWithoutPassword as User,
          isAuthenticated: true,
        });

        return {
          valid: true,
          message: 'Login berhasil',
          data: userWithoutPassword,
        };
      },

      logout: () => {
        // PRODUCTION: await supabase.auth.signOut()
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'uam-auth', // localStorage key
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
