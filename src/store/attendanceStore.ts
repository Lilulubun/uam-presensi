import { create } from 'zustand';
import type { AttendanceState, Attendance } from '../types';
import { supabase } from '../lib/supabase';
import { toCamelCaseArray } from '../lib/transform';

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  attendances: [] as Attendance[],
  loading: false,

  init: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('attendances')
      .select('id,session_id,user_id,scan_in_time,scan_out_time,is_late,late_minutes,scan_in_location,scan_out_location,checkout_method')
      .order('scan_in_time', { ascending: false })
      .limit(500);
    if (!error && data) {
      set({ attendances: toCamelCaseArray<Attendance>(data), loading: false });
    } else {
      if (error) console.error('attendanceStore.init error:', error);
      set({ loading: false });
    }
  },

  getAttendanceBySession: (sessionId: string): Attendance[] => {
    return get().attendances.filter((a) => a.sessionId === sessionId);
  },

  getAttendanceByUser: (userId: string): Attendance[] => {
    return get().attendances.filter((a) => a.userId === userId);
  },
}));
