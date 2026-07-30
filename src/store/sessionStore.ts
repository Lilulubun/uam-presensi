import { create } from 'zustand';
import type { SessionState, Session, ValidationResult, Coordinates } from '../types';
import { supabase } from '../lib/supabase';
import { logEvent } from '../lib/log-event';
import { toCamelCase, toCamelCaseArray } from '../lib/transform';
import { useAttendanceStore } from './attendanceStore';
import { useUsersStore } from './userStore';

const RPC_NOT_AUTHENTICATED_MSG = 'Sesi tidak dapat dibuka: tidak terautentikasi. Silakan login ulang.';

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

  openSession: async (tpaId: string, location: Coordinates): Promise<ValidationResult> => {
    const { data, error } = await supabase.rpc('open_session', {
      p_tpa_id: tpaId,
      p_location: { lat: location.lat, lng: location.lng },
    });
    if (error || !data) {
      if (error?.message?.toLowerCase().includes('not authenticated')) {
        return { valid: false, message: RPC_NOT_AUTHENTICATED_MSG };
      }
      return mapRpcError(error);
    }
    const session = toCamelCase<Session>(data);
    set((state) => ({
      sessions: [...state.sessions.filter((s) => s.id !== session.id), session],
      activeSession: session,
    }));
    logEvent('session_opened', session.id);
    useAttendanceStore.getState().init();
    return {
      valid: true,
      message: 'Sesi berhasil dibuka dan presensi Anda telah dicatat',
      data: session,
    };
  },

  openSessionWithExpected: async (tpaId: string, location: Coordinates, expectedUserIds: string[]): Promise<ValidationResult> => {
    const { data, error } = await supabase.rpc('open_session_with_expected', {
      p_tpa_id: tpaId,
      p_location: { lat: location.lat, lng: location.lng },
      p_expected_user_ids: expectedUserIds,
    });
    if (error || !data) {
      if (error?.message?.toLowerCase().includes('not authenticated')) {
        return { valid: false, message: RPC_NOT_AUTHENTICATED_MSG };
      }
      return mapRpcError(error);
    }
    const session = toCamelCase<Session>(data);
    set((state) => ({
      sessions: [...state.sessions.filter((s) => s.id !== session.id), session],
      activeSession: session,
    }));
    logEvent('session_opened', session.id);
    useAttendanceStore.getState().init();
    return {
      valid: true,
      message: 'Sesi berhasil dibuka dan presensi Anda telah dicatat',
      data: session,
    };
  },

  closeSession: async (sessionId: string, location?: Coordinates, notes?: string): Promise<ValidationResult> => {
    const rpcParams: Record<string, unknown> = { 
      p_session_id: sessionId,
    };
    if (notes) rpcParams.p_notes = notes;
    if (location) {
      rpcParams.p_location = { lat: location.lat, lng: location.lng };
    }
    const { data, error } = await supabase.rpc('close_session', rpcParams);
    if (error || !data) return mapRpcError(error);
    const updated = toCamelCase<Session>(data);
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? updated : s)),
      activeSession: state.activeSession?.id === sessionId ? null : state.activeSession,
    }));
    logEvent('session_closed', sessionId);
    useAttendanceStore.getState().init();
    return { valid: true, message: 'Sesi berhasil ditutup', data: updated };
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
