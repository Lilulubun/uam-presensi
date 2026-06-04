import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useSessionStore } from '../../store/sessionStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useUsersStore } from '../../store/userStore';

const CHANNEL_NAME = 'uam-changes';

export function useRealtimeSessions(): void {
  useEffect(() => {
    const channel = supabase
      .channel(CHANNEL_NAME)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => {
        useSessionStore.getState().init();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendances' }, () => {
        useAttendanceStore.getState().init();
        useUsersStore.getState().init();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
