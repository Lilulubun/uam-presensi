import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SessionState, Session, ValidationResult } from '../types';
import { generateDynamicToken, isTokenExpired } from '../lib/qr-utils';

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSession: null,

      openSession: async (
        tpaId: string,
        userId: string
      ): Promise<ValidationResult> => {
        const state = get();

        // Validate: check if TPA already has active session
        const existingSession = state.sessions.find(
          (s) => s.tpaId === tpaId && s.isActive
        );

        if (existingSession) {
          return {
            valid: false,
            message: 'TPA ini sudah memiliki sesi aktif',
            data: existingSession,
          };
        }

        // KNOWN LIMITATION: Race condition possible with localStorage
        // PRODUCTION: Use Supabase RPC with database lock:
        // const { data, error } = await supabase.rpc('open_session', { tpa_id, user_id })

        const now = new Date();
        const qrToken = generateDynamicToken(crypto.randomUUID(), 'in');

        const newSession: Session = {
          id: crypto.randomUUID(),
          tpaId,
          firstTeacherId: userId,
          dateOpened: now,
          isActive: true,
          qrDynamicInToken: qrToken.token,
          qrDynamicInExpiry: new Date(qrToken.expiry),
        };

        set({
          sessions: [...state.sessions, newSession],
          activeSession: newSession,
        });

        return {
          valid: true,
          message: 'Sesi berhasil dibuka',
          data: newSession,
        };
      },

      closeSession: async (sessionId: string): Promise<ValidationResult> => {
        const state = get();
        const sessionIndex = state.sessions.findIndex(
          (s) => s.id === sessionId
        );

        if (sessionIndex === -1) {
          return {
            valid: false,
            message: 'Sesi tidak ditemukan',
          };
        }

        const session = state.sessions[sessionIndex];

        if (!session.isActive) {
          return {
            valid: false,
            message: 'Sesi sudah ditutup',
          };
        }

        // PRODUCTION: Supabase RPC
        // const { error } = await supabase.rpc('close_session', { session_id })

        const now = new Date();
        const qrToken = generateDynamicToken(sessionId, 'out');

        const updatedSession: Session = {
          ...session,
          isActive: false,
          dateClosed: now,
          qrDynamicOutToken: qrToken.token,
          qrDynamicOutExpiry: new Date(qrToken.expiry),
        };

        const newSessions = [...state.sessions];
        newSessions[sessionIndex] = updatedSession;

        set({
          sessions: newSessions,
          activeSession: null,
        });

        return {
          valid: true,
          message: 'Sesi berhasil ditutup',
          data: updatedSession,
        };
      },

      refreshQRToken: (sessionId: string, type: 'in' | 'out') => {
        const state = get();
        const sessionIndex = state.sessions.findIndex(
          (s) => s.id === sessionId
        );

        if (sessionIndex === -1) return;

        const session = state.sessions[sessionIndex];
        // Only refresh QR-in for active sessions; QR-out refreshes for closed sessions
        if (type === 'in' && !session.isActive) return;
        if (type === 'out' && session.isActive) return;

        const qrToken = generateDynamicToken(sessionId, type);

        const updatedSession: Session = {
          ...session,
          ...(type === 'in'
            ? {
                qrDynamicInToken: qrToken.token,
                qrDynamicInExpiry: new Date(qrToken.expiry),
              }
            : {
                qrDynamicOutToken: qrToken.token,
                qrDynamicOutExpiry: new Date(qrToken.expiry),
              }),
        };

        const newSessions = [...state.sessions];
        newSessions[sessionIndex] = updatedSession;

        set({ sessions: newSessions });

        // Update activeSession if it's the current one
        if (state.activeSession?.id === sessionId) {
          set({ activeSession: updatedSession });
        }
      },

      getActiveSessionByTPA: (tpaId: string): Session | null => {
        return (
          get().sessions.find((s) => s.tpaId === tpaId && s.isActive) || null
        );
      },
    }),
    {
      name: 'uam-sessions',
      partialize: (state) => ({
        sessions: state.sessions,
        activeSession: state.activeSession,
      }),
    }
  )
);
