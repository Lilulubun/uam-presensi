import { create } from 'zustand';
import type { SessionState, Session, ValidationResult, Coordinates } from '../types';
import { supabase } from '../lib/supabase';
import { logEvent } from '../lib/log-event';
import { toCamelCase } from '../lib/transform';

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
      .select('*')
      .eq('is_active', true)
      .eq('first_teacher_id', userId)
      .maybeSingle();
    if (data && !error) {
      const s = toCamelCase<Session>(data);
      set({ sessions: [s], activeSession: s, loading: false });
    } else {
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
    return {
      valid: true,
      message: 'Sesi berhasil dibuka dan presensi Anda telah dicatat',
      data: session,
    };
  },

  closeSession: async (sessionId: string): Promise<ValidationResult> => {
    const { data, error } = await supabase.rpc('close_session', { p_session_id: sessionId });
    if (error || !data) return mapRpcError(error);
    const updated = toCamelCase<Session>(data);
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? updated : s)),
      activeSession: state.activeSession?.id === sessionId ? null : state.activeSession,
    }));
    logEvent('session_closed', sessionId);
    return { valid: true, message: 'Sesi berhasil ditutup', data: updated };
  },

  forceCloseSession: async (sessionId: string): Promise<ValidationResult> => {
    const { data, error } = await supabase.rpc('admin_force_close', { p_session_id: sessionId });
    if (error || !data) return mapRpcError(error);
    const updated = toCamelCase<Session>(data);
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? updated : s)),
      activeSession: state.activeSession?.id === sessionId ? null : state.activeSession,
    }));
    return { valid: true, message: 'Sesi berhasil ditutup oleh admin', data: updated };
  },

  refreshQRToken: async (sessionId: string, type: 'in' | 'out'): Promise<ValidationResult> => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) return { valid: false, message: 'Sesi tidak ditemukan' };

    const expiry = type === 'in' ? session.qrDynamicInExpiry : session.qrDynamicOutExpiry;
    if (expiry && new Date(expiry).getTime() > Date.now()) {
      return { valid: true, message: 'Token masih berlaku', data: session };
    }

    const { data, error } = await supabase.rpc('rotate_qr_token', {
      p_session_id: sessionId,
      p_direction: type,
    });
    if (error || !data) return mapRpcError(error);

    const { token, expiry: newExpiry } = data as { token: string; expiry: string };
    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        return type === 'in'
          ? { ...s, qrDynamicInToken: token, qrDynamicInExpiry: new Date(newExpiry) }
          : { ...s, qrDynamicOutToken: token, qrDynamicOutExpiry: new Date(newExpiry) };
      }),
      activeSession: state.activeSession?.id === sessionId
        ? (type === 'in'
            ? { ...state.activeSession, qrDynamicInToken: token, qrDynamicInExpiry: new Date(newExpiry) }
            : { ...state.activeSession, qrDynamicOutToken: token, qrDynamicOutExpiry: new Date(newExpiry) })
        : state.activeSession,
    }));
    return { valid: true, message: 'Token dirotasi', data: { token, expiry: newExpiry } };
  },

  getActiveSessionByTPA: (tpaId: string): Session | null => {
    return get().sessions.find((s) => s.tpaId === tpaId && s.isActive) ?? null;
  },
}));
