import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { mockRemoveChannel, mockSubscribe, mockOn, mockChannel } = vi.hoisted(() => {
  const mockRemoveChannel = vi.fn();
  const mockSubscribe = vi.fn(function (this: any) { return this; });
  const mockOn = vi.fn().mockReturnThis();
  const mockChannel = vi.fn(() => ({ on: mockOn, subscribe: mockSubscribe }));
  return { mockRemoveChannel, mockSubscribe, mockOn, mockChannel };
});

vi.mock('../../../lib/supabase', () => ({
  supabase: { channel: mockChannel, removeChannel: mockRemoveChannel },
}));

vi.mock('../../../store/sessionStore', () => ({
  useSessionStore: { getState: () => ({ init: vi.fn().mockResolvedValue(undefined) }) },
}));
vi.mock('../../../store/attendanceStore', () => ({
  useAttendanceStore: { getState: () => ({ init: vi.fn().mockResolvedValue(undefined) }) },
}));

import { useRealtimeSessions } from '../useRealtimeSessions';

describe('useRealtimeSessions', () => {
  beforeEach(() => {
    mockChannel.mockClear();
    mockOn.mockClear();
    mockSubscribe.mockClear();
    mockRemoveChannel.mockClear();
  });

  it('subscribes to a single channel on mount and removes it on unmount', () => {
    const { unmount } = renderHook(() => useRealtimeSessions());
    expect(mockChannel).toHaveBeenCalledWith('uam-changes');
    const ch = mockChannel.mock.results[0].value;
    expect(ch.on).toHaveBeenCalled();
    expect(ch.subscribe).toHaveBeenCalled();
    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledWith(ch);
  });

  it('subscribes to BOTH the sessions and attendances tables', () => {
    renderHook(() => useRealtimeSessions());
    const ch = mockChannel.mock.results[0].value;
    const tables = ch.on.mock.calls.map((c: any[]) => c[1]?.table).filter(Boolean);
    expect(tables).toContain('sessions');
    expect(tables).toContain('attendances');
  });

  it('does not double-subscribe across two parallel hook instances', () => {
    renderHook(() => useRealtimeSessions());
    renderHook(() => useRealtimeSessions());
    expect(mockChannel).toHaveBeenCalledTimes(2);
  });
});
