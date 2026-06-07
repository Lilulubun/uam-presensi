import { create } from 'zustand';
import type { IzinRequest, ValidationResult, DailyReportRow } from '../types';
import { supabase } from '../lib/supabase';
import { toCamelCase, toCamelCaseArray } from '../lib/transform';

interface IzinState {
  myIzins: IzinRequest[];
  pendingIzins: IzinRequest[];
  allIzins: IzinRequest[];
  monthlyReport: DailyReportRow[];
  loading: boolean;

  submitIzin: (startDate: string, endDate: string, alasan: string) => Promise<ValidationResult>;
  approveIzin: (id: string) => Promise<ValidationResult>;
  rejectIzin: (id: string) => Promise<ValidationResult>;
  fetchMyIzins: () => Promise<void>;
  fetchPendingIzins: () => Promise<void>;
  fetchAllIzins: () => Promise<void>;
  fetchMonthlyReport: (userId: string, year: number, month: number) => Promise<void>;
}

function mapRpcError(error: { message: string } | null): ValidationResult {
  if (!error) return { valid: false, message: 'Kesalahan tidak diketahui' };
  return { valid: false, message: error.message };
}

export const useIzinStore = create<IzinState>((set) => ({
  myIzins: [],
  pendingIzins: [],
  allIzins: [],
  monthlyReport: [],
  loading: false,

  submitIzin: async (startDate, endDate, alasan) => {
    const { data, error } = await supabase.rpc('submit_izin', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_alasan: alasan,
    });
    if (error || !data) return mapRpcError(error);
    const izin = toCamelCase<IzinRequest>(data);
    set((s) => ({ myIzins: [...s.myIzins, izin] }));
    return { valid: true, message: 'Izin berhasil diajukan. Menunggu persetujuan.' };
  },

  approveIzin: async (id) => {
    const { data, error } = await supabase.rpc('approve_izin', { p_izin_id: id });
    if (error || !data) return mapRpcError(error);
    set((s) => ({
      pendingIzins: s.pendingIzins.filter((r) => r.id !== id),
      myIzins: s.myIzins.map((r) => (r.id === id ? { ...r, status: 'approved' as const } : r)),
    }));
    return { valid: true, message: 'Izin disetujui' };
  },

  rejectIzin: async (id) => {
    const { data, error } = await supabase.rpc('reject_izin', { p_izin_id: id });
    if (error || !data) return mapRpcError(error);
    set((s) => ({
      pendingIzins: s.pendingIzins.filter((r) => r.id !== id),
      myIzins: s.myIzins.map((r) => (r.id === id ? { ...r, status: 'rejected' as const } : r)),
    }));
    return { valid: true, message: 'Izin ditolak' };
  },

  fetchMyIzins: async () => {
    set({ loading: true });
    const { data, error } = await supabase.rpc('get_my_izins');
    if (!error && data) {
      set({ myIzins: toCamelCaseArray<IzinRequest>(data), loading: false });
    } else {
      if (error) console.error('fetchMyIzins error:', error);
      set({ loading: false });
    }
  },

  fetchPendingIzins: async () => {
    const { data, error } = await supabase.rpc('get_pending_izins');
    if (!error && data) {
      set({ pendingIzins: toCamelCaseArray<IzinRequest>(data) });
    } else {
      if (error) console.error('fetchPendingIzins error:', error);
    }
  },

  fetchAllIzins: async () => {
    const { data, error } = await supabase.rpc('get_all_izins');
    if (!error && data) {
      set({ allIzins: toCamelCaseArray<IzinRequest>(data) });
    } else {
      if (error) console.error('fetchAllIzins error:', error);
    }
  },

  fetchMonthlyReport: async (userId, year, month) => {
    const { data, error } = await supabase.rpc('get_teacher_monthly_report', {
      p_user_id: userId,
      p_year: year,
      p_month: month,
    });
    if (!error && data) {
      set({ monthlyReport: toCamelCaseArray<DailyReportRow>(data) });
    } else {
      if (error) console.error('fetchMonthlyReport error:', error);
    }
  },
}));
