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

  describe('checkIn()', () => {
    it('calls check_in RPC and stores the returned attendance for a normal scan', async () => {
      mockRpc.mockResolvedValue({
        data: { attendance: baseAtt, reason: null },
        error: null,
      });
      const result = await useAttendanceStore.getState().checkIn(
        'session-uuid-1', 'qr-token-abc', { lat: -7.7, lng: 110.4 },
      );
      expect(mockRpc).toHaveBeenCalledWith('check_in', {
        p_session_id: 'session-uuid-1',
        p_token: 'qr-token-abc',
        p_location: { lat: -7.7, lng: 110.4 },
      });
      expect(result.valid).toBe(true);
      expect(result.data?.reason).toBeNull();
      expect(useAttendanceStore.getState().attendances.some(a => a.id === 'att-uuid-1')).toBe(true);
    });

    it('returns reason=FIRST_TEACHER_AUTO for first teacher re-scan (no second insert)', async () => {
      useAttendanceStore.setState({ attendances: [baseAtt] } as any);
      mockRpc.mockResolvedValue({
        data: { attendance: baseAtt, reason: 'FIRST_TEACHER_AUTO' },
        error: null,
      });
      const result = await useAttendanceStore.getState().checkIn(
        'session-uuid-1', 'qr-token-abc', { lat: -7.7, lng: 110.4 },
      );
      expect(result.valid).toBe(true);
      expect(result.data?.reason).toBe('FIRST_TEACHER_AUTO');
      // Still only one row in the cache (no duplicate insert)
      expect(useAttendanceStore.getState().attendances.length).toBe(1);
    });

    it('surfaces Indonesian error from GPS-out-of-radius RPC', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Anda berada di luar radius TPA' },
      });
      const result = await useAttendanceStore.getState().checkIn(
        'session-uuid-1', 'qr-token-abc', { lat: -8, lng: 110.5 },
      );
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Anda berada di luar radius TPA');
      expect(useAttendanceStore.getState().attendances.length).toBe(0);
    });
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
