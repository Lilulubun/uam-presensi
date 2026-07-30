import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let sessionsData: any = [];

const { mockRpc, mockGetUser, resetMocks } = vi.hoisted(() => {
  const mockRpc = vi.fn();
  const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-uuid-1' } }, error: null });
  const resetMocks = () => {
    mockRpc.mockReset();
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid-1' } }, error: null });
    sessionsData = [];
  };
  return { mockRpc, mockGetUser, resetMocks };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    from: (table: string) => {
      if (table === 'sessions') {
        const chain = {
          order: () => chain,
          limit: () => ({
            then: (resolve: (v: any) => void) => resolve({ data: sessionsData, error: null }),
          }),
        };
        return {
          select: () => chain,
        };
      }
      if (table === 'attendances') {
        const chain = {
          order: () => chain,
          limit: () => ({
            then: (resolve: any) => resolve({ data: [], error: null }),
          }),
        };
        return {
          select: () => chain,
        };
      }
      return { select: vi.fn() };
    },
  },
}));

vi.mock('zustand/middleware', async () => {
  const actual = await vi.importActual<typeof import('zustand/middleware')>('zustand/middleware');
  return { ...actual, persist: (config: any) => config };
});

import { useSessionStore } from '../sessionStore';
import type { Session } from '../../types';

const fakeSession: Session = {
  id: 'session-uuid-1',
  tpaId: 'tpa-001',
  firstTeacherId: 'user-uuid-1',
  dateOpened: new Date('2026-06-02T10:00:00Z'),
  isActive: true,
};

describe('useSessionStore (Supabase-backed)', () => {
  beforeEach(() => {
    resetMocks();
    useSessionStore.setState({ sessions: [], activeSession: null, loading: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('init()', () => {
    it('populates activeSession when the user has an open session', async () => {
      sessionsData = [fakeSession];
      await useSessionStore.getState().init();
      const { activeSession } = useSessionStore.getState();
      expect(activeSession?.id).toBe('session-uuid-1');
      expect(useSessionStore.getState().loading).toBe(false);
    });

    it('leaves activeSession null when no open session', async () => {
      sessionsData = [];
      await useSessionStore.getState().init();
      expect(useSessionStore.getState().activeSession).toBeNull();
    });
  });

  describe('forceCloseSession()', () => {
    beforeEach(() => {
      useSessionStore.setState({ sessions: [fakeSession], activeSession: fakeSession });
    });

    it('calls force_close_session_v2 RPC and clears activeSession on success', async () => {
      const closed = { ...fakeSession, isActive: false, dateClosed: new Date() };
      mockRpc.mockResolvedValue({ data: closed, error: null });
      const result = await useSessionStore.getState().forceCloseSession(fakeSession.id);
      expect(mockRpc).toHaveBeenCalledWith('force_close_session_v2', { p_session_id: fakeSession.id });
      expect(result.valid).toBe(true);
      expect(result.message).toBe('Sesi berhasil ditutup oleh admin');
      expect(useSessionStore.getState().activeSession).toBeNull();
    });

    it('surfaces server error when not authorized (non-pengurus)', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } });
      const result = await useSessionStore.getState().forceCloseSession(fakeSession.id);
      expect(result.valid).toBe(false);
      expect(result.message).toBe('forbidden');
      expect(useSessionStore.getState().activeSession).not.toBeNull();
    });
  });

  describe('getActiveSessionByTPA()', () => {
    it('returns the active session when tpaId matches', () => {
      useSessionStore.setState({ sessions: [fakeSession], activeSession: fakeSession });
      const got = useSessionStore.getState().getActiveSessionByTPA('tpa-001');
      expect(got?.id).toBe('session-uuid-1');
    });

    it('returns null when the TPA has no active session', () => {
      useSessionStore.setState({ sessions: [], activeSession: null });
      expect(useSessionStore.getState().getActiveSessionByTPA('tpa-001')).toBeNull();
    });
  });
});
