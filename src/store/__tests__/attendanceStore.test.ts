import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockRpc, mockFrom, resetMocks } = vi.hoisted(() => {
  const mockRpc = vi.fn();
  const mockFrom = vi.fn();
  const resetMocks = () => {
    mockRpc.mockReset();
    mockFrom.mockReset();
  };
  return { mockRpc, mockFrom, resetMocks };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom,
  },
}));

vi.mock('zustand/middleware', async () => {
  const actual = await vi.importActual<typeof import('zustand/middleware')>('zustand/middleware');
  return { ...actual, persist: (config: any) => config };
});

import { useAttendanceStore } from '../attendanceStore';
import type { Attendance } from '../../types';

const baseAtt: Attendance = {
  id: 'att-uuid-1',
  sessionId: 'session-uuid-1',
  userId: 'user-uuid-1',
  scanInTime: new Date('2026-06-02T10:00:00Z'),
  scanInLocation: { lat: -7.7, lng: 110.4 },
  isLate: false,
  lateMinutes: 0,
};

describe('useAttendanceStore (Supabase-backed)', () => {
  beforeEach(() => {
    resetMocks();
    useAttendanceStore.setState({ attendances: [], loading: false } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getAttendanceBySession()', () => {
    it('returns only attendances for the given sessionId', () => {
      useAttendanceStore.setState({
        attendances: [baseAtt, { ...baseAtt, id: 'att-2', sessionId: 'session-2' }],
      } as any);
      const got = useAttendanceStore.getState().getAttendanceBySession('session-uuid-1');
      expect(got.length).toBe(1);
      expect(got[0].id).toBe('att-uuid-1');
    });
  });

  describe('getAttendanceByUser()', () => {
    it('returns only attendances for the given userId', () => {
      useAttendanceStore.setState({
        attendances: [baseAtt, { ...baseAtt, id: 'att-2', userId: 'user-2' }],
      } as any);
      const got = useAttendanceStore.getState().getAttendanceByUser('user-uuid-1');
      expect(got.length).toBe(1);
      expect(got[0].id).toBe('att-uuid-1');
    });
  });
});
