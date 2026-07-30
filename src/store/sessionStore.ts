import { create } from 'zustand';
import type { SessionState, Session, ValidationResult } from '../types';
import { supabase } from '../lib/supabase';
import { toCamelCase, toCamelCaseArray } from '../lib/transform';
import { useAttendanceStore } from './attendanceStore';
import { useUsersStore } from './userStore';

function mapRpcError(error: { message: string } | null): ValidationResult {
  if (!error) return { valid: false, message: 'Kesalahan tidak diketahui' };
  return { valid: false, message: error.message };
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [] as Session[],
  activeSession: null,
  loading: false,

  init: async () => {
    set({ loading: true });
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;
    if (!userId) { set({ loading: false }); return; }
    const { data, error } = await supabase
      .from('sessions')
      .select('id,tpa_id,first_teacher_id,date_opened,date_closed,is_active,close_notes,expected_at_open')
      .order('date_opened', { ascending: false })
      .limit(200);
    if (data && !error) {
      const sessions = toCamelCaseArray<Session>(data);
      const activeSession = sessions.find((s) => s.isActive && s.firstTeacherId === userId) ?? null;
      set({ sessions, activeSession, loading: false });
    } else {
      if (error) console.error('sessionStore.init error:', error);
      set({ loading: false });
    }
  },

  forceCloseSession: async (sessionId: string): Promise<ValidationResult> => {
    const { data, error } = await supabase.rpc('force_close_session_v2', { p_session_id: sessionId });
    if (error || !data) return mapRpcError(error);
    const updated = toCamelCase<Session>(data);
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? updated : s)),
      activeSession: state.activeSession?.id === sessionId ? null : state.activeSession,
    }));
    useAttendanceStore.getState().init();
    useUsersStore.getState().init();
    return { valid: true, message: 'Sesi berhasil ditutup oleh admin', data: updated };
  },

  getActiveSessionByTPA: (tpaId: string): Session | null => {
    return get().sessions.find((s) => s.tpaId === tpaId && s.isActive) ?? null;
  },

  fetchMyExpectedSessions: async (year: number, month: number): Promise<Set<string>> => {
    const { data, error } = await supabase.rpc('get_my_expected_sessions', {
      p_year: year,
      p_month: month,
    });
    if (error) {
      console.error('fetchMyExpectedSessions error:', error);
      return new Set();
    }
    return new Set((data as { session_id: string }[]).map((row) => row.session_id));
  },
}));
