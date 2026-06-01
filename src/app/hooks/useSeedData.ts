import { useEffect } from 'react';
import { generateSeedData, shouldSeed, markSeeded } from '../../lib/seed-data';
import { useSessionStore } from '../../store/sessionStore';
import { useAttendanceStore } from '../../store/attendanceStore';

export function useSeedData() {
  useEffect(() => {
    if (!shouldSeed()) return;

    const { sessions, attendances } = generateSeedData();

    useSessionStore.setState((state) => ({
      sessions: [...sessions, ...state.sessions],
      activeSession: state.activeSession,
    }));

    useAttendanceStore.setState((state) => ({
      attendances: [...attendances, ...state.attendances],
    }));

    markSeeded();
  }, []);
}
