import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { recoveryEvents } = vi.hoisted(() => ({ recoveryEvents: { callback: undefined as undefined | ((event: string, session: any) => unknown) } }));

// Hoisted mock handles — referenced by both the vi.mock factory and the test bodies
const { mockGetSession, mockSignInWithPassword, mockSignOut, mockProfileSelect, mockRpc, resetMocks } = vi.hoisted(() => {
  const mockGetSession = vi.fn();
  const mockSignInWithPassword = vi.fn();
  const mockSignOut = vi.fn();
  const mockProfileSelect = vi.fn();
  const mockRpc = vi.fn();
  const resetMocks = () => {
    mockGetSession.mockReset();
    mockSignInWithPassword.mockReset();
    mockSignOut.mockReset();
    mockProfileSelect.mockReset();
    mockRpc.mockReset();
  };
  return { mockGetSession, mockSignInWithPassword, mockSignOut, mockProfileSelect, mockRpc, resetMocks };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      onAuthStateChange: vi.fn((callback) => {
        recoveryEvents.callback = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
    rpc: mockRpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockProfileSelect,
        }),
      }),
    }),
  },
}));

vi.mock('zustand/middleware', async () => {
  const actual = await vi.importActual<typeof import('zustand/middleware')>('zustand/middleware');
  return {
    ...actual,
    persist: (config: any) => config,
  };
});

import { useAuthStore } from '../authStore';

describe('useAuthStore (Supabase-backed)', () => {
  beforeEach(() => {
    resetMocks();
    useAuthStore.setState({ user: null, isAuthenticated: false, loading: true, recoveryUserId: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('recovery events', () => {
    it('captures recovery before getSession resolves without auth calls inside callback', async () => {
      mockGetSession.mockImplementation(async () => {
        expect(recoveryEvents.callback).toBeTypeOf('function');
        expect(recoveryEvents.callback!('PASSWORD_RECOVERY', { user: { id: 'recovery-user' }, expires_at: Date.now() / 1000 + 3600 })).toBeUndefined();
        expect(mockRpc).not.toHaveBeenCalled();
        expect(useAuthStore.getState()).toHaveProperty('recoveryUserId', 'recovery-user');
        return { data: { session: null } };
      });
      await useAuthStore.getState().init();
      expect(useAuthStore.getState()).toHaveProperty('recoveryUserId', 'recovery-user');
    });
  });

  describe('init()', () => {
    it('sets loading=false and stays unauthenticated when no session exists', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });
      await useAuthStore.getState().init();
      const { user, isAuthenticated, loading } = useAuthStore.getState();
      expect(user).toBeNull();
      expect(isAuthenticated).toBe(false);
      expect(loading).toBe(false);
    });

    it('fetches profile and authenticates when a session exists', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'auth-uuid-budi' } } },
      });
      mockRpc.mockResolvedValue({
        data: [{ id: 'auth-uuid-budi', email: 'budi@uii.ac.id', name: 'Budi Santoso', role: 'pengajar', nim: '20521001', is_active: true }],
        error: null,
      });
      await useAuthStore.getState().init();
      const { user, isAuthenticated, loading } = useAuthStore.getState();
      expect(user).toMatchObject({ id: 'auth-uuid-budi', role: 'pengajar' });
      expect(isAuthenticated).toBe(true);
      expect(loading).toBe(false);
    });
  });

  describe('login()', () => {
    it('resolves NIM to email and calls signInWithPassword', async () => {
      mockRpc.mockImplementation((name, args) => {
        if (name === 'get_emails_by_nim' && args.p_nim === '20521002') {
          return Promise.resolve({ data: [{ email: 'siti@uii.ac.id' }], error: null });
        }
        if (name === 'get_profile') {
          return Promise.resolve({
            data: [{ id: 'auth-uuid-siti', email: 'siti@uii.ac.id', name: 'Siti Rahayu', role: 'pengajar', nim: '20521002', is_active: true }],
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'auth-uuid-siti' }, session: {} },
        error: null,
      });

      const result = await useAuthStore.getState().login('20521002', 'pw');

      expect(mockRpc).toHaveBeenCalledWith('get_emails_by_nim', { p_nim: '20521002' });
      expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'siti@uii.ac.id', password: 'pw' });
      expect(result.valid).toBe(true);
      expect(useAuthStore.getState().user?.email).toBe('siti@uii.ac.id');
    });

    it('calls signInWithPassword directly if identifier is an email', async () => {
      mockRpc.mockResolvedValue({
        data: [{ id: 'auth-uuid-siti', email: 'siti@uii.ac.id', name: 'Siti Rahayu', role: 'pengajar', nim: '20521002', is_active: true }],
        error: null,
      });
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'auth-uuid-siti' }, session: {} },
        error: null,
      });

      const result = await useAuthStore.getState().login('siti@uii.ac.id', 'pw');

      expect(mockRpc).not.toHaveBeenCalledWith('get_emails_by_nim', expect.anything());
      expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'siti@uii.ac.id', password: 'pw' });
      expect(result.valid).toBe(true);
    });

    it('returns error if NIM is not found', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const result = await useAuthStore.getState().login('wrong_nim', 'pw');

      expect(result.valid).toBe(false);
      expect(result.message).toBe('NIM tidak ditemukan');
      expect(mockSignInWithPassword).not.toHaveBeenCalled();
    });

    it('returns invalid Indonesian result on auth error', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      const result = await useAuthStore.getState().login('budi@uii.ac.id', 'wrong');

      expect(result.valid).toBe(false);
      expect(result.message).toMatch(/salah|invalid|kredensial/i);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('logout()', () => {
    it('calls signOut and clears state', async () => {
      useAuthStore.setState({
        user: { id: 'x', email: 'x@x', name: 'X', role: 'pengajar' },
        isAuthenticated: true,
      });
      mockSignOut.mockResolvedValue({ error: null });

      await useAuthStore.getState().logout();

      expect(mockSignOut).toHaveBeenCalled();
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });
});
