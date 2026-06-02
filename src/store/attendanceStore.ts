import { create } from 'zustand';
import type { AttendanceState, Attendance, Coordinates, ValidationResult, CheckInResult } from '../types';
import { supabase } from '../lib/supabase';
import { logEvent } from '../lib/log-event';

function errorResult(message: string, sessionId?: string): ValidationResult {
  if (sessionId) {
    if (/radius/i.test(message)) {
      logEvent('scan_in_gps_denied', sessionId, { error: message });
    } else if (/tidak valid|kadaluarsa/i.test(message)) {
      logEvent('qr_expired', sessionId, { error: message });
    }
  }
  return { valid: false, message };
}

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  attendances: [] as Attendance[],
  loading: false,

  init: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('attendances')
      .select('*')
      .order('scan_in_time', { ascending: false });
    if (!error && data) {
      set({ attendances: data as Attendance[], loading: false });
    } else {
      set({ loading: false });
    }
  },

  checkIn: async (
    sessionId: string,
    token: string,
    location: Coordinates,
  ): Promise<ValidationResult> => {
    const { data, error } = await supabase.rpc('check_in', {
      p_session_id: sessionId,
      p_token: token,
      p_location: { lat: location.lat, lng: location.lng },
    });
    if (error || !data) {
      return errorResult(error?.message ?? 'Gagal melakukan presensi masuk', sessionId);
    }
    const { attendance, reason } = data as CheckInResult;
    if (reason !== 'FIRST_TEACHER_AUTO') {
      set((state) => ({
        attendances: [...state.attendances.filter((a) => a.id !== attendance.id), attendance],
      }));
      logEvent('scan_in_success', sessionId);
    }
    return {
      valid: true,
      message: reason === 'FIRST_TEACHER_AUTO'
        ? 'Presensi Anda sudah otomatis tercatat saat membuka sesi'
        : 'Presensi masuk berhasil',
      data: { attendance, reason },
    };
  },

  checkOut: async (
    sessionId: string,
    token: string,
    location: Coordinates,
  ): Promise<ValidationResult> => {
    const { data, error } = await supabase.rpc('check_out', {
      p_session_id: sessionId,
      p_token: token,
      p_location: { lat: location.lat, lng: location.lng },
    });
    if (error || !data) {
      return errorResult(error?.message ?? 'Gagal melakukan presensi keluar');
    }
    const attendance = data as Attendance;
    set((state) => ({
      attendances: state.attendances.map((a) => (a.id === attendance.id ? attendance : a)),
    }));
    return { valid: true, message: 'Presensi keluar berhasil', data: attendance };
  },

  getAttendanceBySession: (sessionId: string): Attendance[] => {
    return get().attendances.filter((a) => a.sessionId === sessionId);
  },

  getAttendanceByUser: (userId: string): Attendance[] => {
    return get().attendances.filter((a) => a.userId === userId);
  },
}));
