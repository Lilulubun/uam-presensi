import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockRpc, mockSessionsSelect, mockGetUser, resetMocks } = vi.hoisted(() => {
  const mockRpc = vi.fn();
  const mockSessionsSelect = vi.fn();
  const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-uuid-1' } }, error: null });
  const resetMocks = () => {
    mockRpc.mockReset();
    mockSessionsSelect.mockReset();
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid-1' } }, error: null });
  };
  return { mockRpc, mockSessionsSelect, mockGetUser, resetMocks };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    from: (table: string) => {
      if (table === 'sessions') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: mockSessionsSelect,
              }),
            }),
          }),
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
  qrDynamicInToken: 'token-in-abc',
  qrDynamicInExpiry: new Date(Date.now() + 20_000),
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
      mockSessionsSelect.mockResolvedValue({ data: fakeSession, error: null });
      await useSessionStore.getState().init();
      const { activeSession } = useSessionStore.getState();
      expect(activeSession?.id).toBe('session-uuid-1');
      expect(useSessionStore.getState().loading).toBe(false);
    });

    it('leaves activeSession null when no open session', async () => {
      mockSessionsSelect.mockResolvedValue({ data: null, error: null });
      await useSessionStore.getState().init();
      expect(useSessionStore.getState().activeSession).toBeNull();
    });
  });

  describe('openSession()', () => {
    it('calls open_session RPC and stores the returned session as active', async () => {
      mockRpc.mockResolvedValue({ data: fakeSession, error: null });
      const result = await useSessionStore.getState().openSession('tpa-001', { lat: -7.7, lng: 110.4 });
      expect(mockRpc).toHaveBeenCalledWith('open_session', {
        p_tpa_id: 'tpa-001',
        p_location: { lat: -7.7, lng: 110.4 },
      });
      expect(result.valid).toBe(true);
      expect(useSessionStore.getState().activeSession?.id).toBe('session-uuid-1');
      expect(useSessionStore.getState().sessions.some(s => s.id === 'session-uuid-1')).toBe(true);
    });

    it('returns Indonesian error when RPC reports TPA already has active session', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'TPA ini sudah memiliki sesi aktif' } });
      const result = await useSessionStore.getState().openSession('tpa-001', { lat: -7.7, lng: 110.4 });
      expect(result.valid).toBe(false);
      expect(result.message).toBe('TPA ini sudah memiliki sesi aktif');
      expect(useSessionStore.getState().activeSession).toBeNull();
    });

    it('returns Indonesian error when not authenticated', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'not authenticated' } });
      const result = await useSessionStore.getState().openSession('tpa-001', { lat: -7.7, lng: 110.4 });
      expect(result.valid).toBe(false);
      expect(result.message).toMatch(/tidak diotorisasi|autentikasi/i);
    });
  });

  describe('closeSession()', () => {
    beforeEach(() => {
      useSessionStore.setState({ sessions: [fakeSession], activeSession: fakeSession });
    });

    it('calls close_session RPC and clears activeSession on success', async () => {
      const closed = { ...fakeSession, isActive: false, dateClosed: new Date(), qrDynamicOutToken: 'token-out-xyz', qrDynamicOutExpiry: new Date() };
      mockRpc.mockResolvedValue({ data: closed, error: null });
      const result = await useSessionStore.getState().closeSession(fakeSession.id);
      expect(mockRpc).toHaveBeenCalledWith('close_session', { p_session_id: fakeSession.id });
      expect(result.valid).toBe(true);
      expect(useSessionStore.getState().activeSession).toBeNull();
    });

    it('surfaces first-teacher-only error from the server', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'Hanya Pengajar Pertama yang dapat menutup sesi' } });
      const result = await useSessionStore.getState().closeSession(fakeSession.id);
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Hanya Pengajar Pertama yang dapat menutup sesi');
      expect(useSessionStore.getState().activeSession).not.toBeNull();
    });
  });

  describe('forceCloseSession()', () => {
    beforeEach(() => {
      useSessionStore.setState({ sessions: [fakeSession], activeSession: fakeSession });
    });

    it('calls admin_force_close RPC and clears activeSession on success', async () => {
      const closed = { ...fakeSession, isActive: false, dateClosed: new Date() };
      mockRpc.mockResolvedValue({ data: closed, error: null });
      const result = await useSessionStore.getState().forceCloseSession(fakeSession.id);
      expect(mockRpc).toHaveBeenCalledWith('admin_force_close', { p_session_id: fakeSession.id });
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

  describe('refreshQRToken()', () => {
    beforeEach(() => {
      useSessionStore.setState({ sessions: [fakeSession], activeSession: fakeSession });
    });

    it('does NOT call RPC when the in-token is still valid', async () => {
      await useSessionStore.getState().refreshQRToken(fakeSession.id, 'in');
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('calls rotate_qr_token RPC when the in-token has expired and updates the session', async () => {
      useSessionStore.setState({
        sessions: [{ ...fakeSession, qrDynamicInExpiry: new Date(Date.now() - 1000) }],
        activeSession: { ...fakeSession, qrDynamicInExpiry: new Date(Date.now() - 1000) },
      });
      mockRpc.mockResolvedValue({ data: { token: 'new-token', expiry: new Date(Date.now() + 20_000).toISOString() }, error: null });
      await useSessionStore.getState().refreshQRToken(fakeSession.id, 'in');
      expect(mockRpc).toHaveBeenCalledWith('rotate_qr_token', { p_session_id: fakeSession.id, p_direction: 'in' });
      const updated = useSessionStore.getState().sessions.find(s => s.id === fakeSession.id);
      expect(updated?.qrDynamicInToken).toBe('new-token');
    });

    it('is a no-op for an unknown session id', async () => {
      await useSessionStore.getState().refreshQRToken('does-not-exist', 'in');
      expect(mockRpc).not.toHaveBeenCalled();
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
