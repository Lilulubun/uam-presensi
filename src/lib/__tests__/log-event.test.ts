import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

vi.mock('../supabase', () => ({
  supabase: { from: mockFrom },
}));

describe('logEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls supabase.from("interaction_logs").insert with event_type and session_id', async () => {
    const { logEvent } = await import('../log-event');
    await logEvent('scan_in_success', 'session-001', { foo: 'bar' });
    expect(mockFrom).toHaveBeenCalledWith('interaction_logs');
    expect(mockInsert).toHaveBeenCalledWith({
      event_type: 'scan_in_success',
      session_id: 'session-001',
      metadata: { foo: 'bar' },
    });
  });

  it('calls insert without session_id when not provided', async () => {
    const { logEvent } = await import('../log-event');
    await logEvent('test_event');
    expect(mockInsert).toHaveBeenCalledWith({
      event_type: 'test_event',
      session_id: undefined,
      metadata: undefined,
    });
  });

  it('does not throw on failure', async () => {
    mockInsert.mockRejectedValueOnce(new Error('db down'));
    const { logEvent } = await import('../log-event');
    await expect(logEvent('test_event')).resolves.toBeUndefined();
  });
});
