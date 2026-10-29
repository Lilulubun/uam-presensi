import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, sync, refresh, log } = vi.hoisted(() => ({
  rpc: vi.fn(), sync: vi.fn(), refresh: vi.fn(), log: vi.fn(),
}));
vi.mock('../../lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('../sessionStore', () => ({ useSessionStore: { setState: sync } }));
vi.mock('../attendanceStore', () => ({ useAttendanceStore: { getState: () => ({ init: refresh }) } }));
vi.mock('../../lib/log-event', () => ({ logEvent: log }));
import { checkInV2, openSessionV2 } from '../attendanceV2Adapter';

const location = { lat: -7.7, lng: 110.4 };
const requestId = '10000000-0000-0000-0000-000000000001';

beforeEach(() => vi.clearAllMocks());

describe('instrumented attendance RPC contract', () => {
  it.each(['open', 'check'] as const)('maps structured %s rejection without success side effects', async (action) => {
    rpc.mockResolvedValue({ data: { accepted: false, code: 'OUTSIDE_RADIUS', message: 'Anda berada di luar radius TPA' }, error: null });
    const result = action === 'open'
      ? await openSessionV2('tpa', location, ['teacher'], requestId)
      : await checkInV2('session', 'token', location, requestId);
    expect(result).toEqual({ valid: false, message: 'Anda berada di luar radius TPA' });
    expect(rpc.mock.calls[0][1].p_request_id).toBe(requestId);
    expect(sync).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalledWith('scan_in_success_v2', expect.anything());
  });

  it('unwraps successful opening and preserves session/QR contract', async () => {
    const payload = { session: { id: 'session', tpa_id: 'tpa' }, qr: { token: 'private', expiry: 'later' } };
    rpc.mockResolvedValue({ data: { accepted: true, data: payload }, error: null });
    const result = await openSessionV2('tpa', location, ['teacher']);
    expect(result.valid).toBe(true);
    expect(result.data).toEqual({ session: { id: 'session', tpaId: 'tpa' }, qr: payload.qr });
    expect(rpc.mock.calls[0][1].p_request_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(sync).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('preserves first-teacher auto-attendance response', async () => {
    rpc.mockResolvedValue({ data: { accepted: true, data: { attendance: { id: 'att', session_id: 'session' }, reason: 'FIRST_TEACHER_AUTO' } }, error: null });
    const result = await checkInV2('session', 'token', location);
    expect(result.valid).toBe(true);
    expect(result.data.reason).toBe('FIRST_TEACHER_AUTO');
    expect(result.data.attendance.sessionId).toBe('session');
  });

  it('keeps retry rejection out of success flow and reuses supplied ID', async () => {
    rpc.mockResolvedValue({ data: { accepted: false, code: 'REQUEST_ALREADY_PROCESSED', message: 'Permintaan sudah diproses. Muat ulang data sesi.' }, error: null });
    await checkInV2('session', 'token', location, requestId);
    const result = await checkInV2('session', 'token', location, requestId);
    expect(result.valid).toBe(false);
    expect(rpc.mock.calls.map((call) => call[1].p_request_id)).toEqual([requestId, requestId]);
    expect(log).not.toHaveBeenCalled();
  });

  it('preserves transport errors and legacy success during migration rollout', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'network error' } });
    expect(await checkInV2('session', 'token', location)).toEqual({ valid: false, message: 'network error' });
    rpc.mockResolvedValueOnce({ data: { attendance: { id: 'att' }, reason: null }, error: null });
    expect((await checkInV2('session', 'token', location)).valid).toBe(true);
  });
});
