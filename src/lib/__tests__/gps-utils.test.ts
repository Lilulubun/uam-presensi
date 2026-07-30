import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateDistance } from '../gps-utils';
import type { Coordinates } from '../../types';

// ============================================================================
// Known Haversine reference points (verified with NOAA calculator)
// ============================================================================

describe('calculateDistance (Haversine)', () => {
  // --- Same point ---
  it('returns 0 for identical coordinates', () => {
    const dist = calculateDistance(
      { lat: -7.776, lng: 110.378 },
      { lat: -7.776, lng: 110.378 },
    );
    expect(dist).toBe(0);
  });

  // --- Known distance: 0.05° lat ≈ 5.6 km ---
  it('returns ~5.5km between lat -7.77 and -7.82 at same lon', () => {
    const dist = calculateDistance(
      { lat: -7.77, lng: 110.378 },
      { lat: -7.82, lng: 110.378 },
    );
    // 0.05° × 111320 m/° ≈ 5566 m
    expect(dist).toBeGreaterThan(5400);
    expect(dist).toBeLessThan(5700);
  });

  // --- Exact 100m boundary (near-equator latitude arc: 1° ≈ 111,320 m) ---
  it('returns ±100m for 0.000898° lat displacement', () => {
    const dist = calculateDistance(
      { lat: -7.7760, lng: 110.3780 },
      { lat: -7.7769, lng: 110.3780 },
    );
    // 0.0009° × 111320 m/° ≈ 100.2 m
    expect(dist).toBeGreaterThan(98);
    expect(dist).toBeLessThan(105);
  });

  // --- Exact 150m boundary ---
  it('returns ±150m for 0.001347° lat displacement', () => {
    const dist = calculateDistance(
      { lat: -7.7760, lng: 110.3780 },
      { lat: -7.77735, lng: 110.3780 },
    );
    // 0.00135° × 111320 ≈ 150.3 m
    expect(dist).toBeGreaterThan(147);
    expect(dist).toBeLessThan(155);
  });

  // --- Outside radius (200m) ---
  it('returns >180m for larger displacement', () => {
    const dist = calculateDistance(
      { lat: -7.7760, lng: 110.3780 },
      { lat: -7.7778, lng: 110.3780 },
    );
    expect(dist).toBeGreaterThan(180);
  });

  // --- Mixed lon/lat displacement ---
  it('handles diagonal displacement correctly', () => {
    const dist = calculateDistance(
      { lat: -7.7760, lng: 110.3780 },
      { lat: -7.7769, lng: 110.3789 },
    );
    // Diagonal > pure-lat component
    expect(dist).toBeGreaterThan(98);
  });
});

// ============================================================================
// logEvent (TAM telemetry)
// ============================================================================

// We test the behaviour contract: logEvent never throws and calls insert.
const { mockInsert, mockFrom } = vi.hoisted(() => {
  const mockInsert = vi.fn().mockResolvedValue({ error: null });
  const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
  return { mockInsert, mockFrom };
});

vi.mock('../supabase', () => ({
  supabase: { from: mockFrom },
}));

// useAuthStore must be importable by the module; stub its getState
vi.mock('../../store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn().mockReturnValue({ user: { id: 'user-test-1' } }),
  },
}));

import { logEvent } from '../log-event';

describe('logEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  it('inserts into interaction_logs with event, session, user, metadata', async () => {
    await logEvent('scan_in_success_v2', 'sess-1', { accuracy: 5.2 });
    expect(mockFrom).toHaveBeenCalledWith('interaction_logs');
    expect(mockInsert).toHaveBeenCalledWith({
      event_type: 'scan_in_success_v2',
      session_id: 'sess-1',
      user_id: 'user-test-1',
      metadata: { accuracy: 5.2 },
    });
  });

  it('never throws on insert failure (fire-and-forget)', async () => {
    mockInsert.mockRejectedValueOnce(new Error('DB down'));
    await expect(logEvent('test', 'sess-1')).resolves.toBeUndefined();
  });
});

// ============================================================================
// Coordinates accuracy (optional field)
// ============================================================================

describe('Coordinates accuracy', () => {
  it('accepts coordinates without accuracy (backward compat)', () => {
    const coords: Coordinates = { lat: -7.77, lng: 110.37 };
    expect(coords.lat).toBe(-7.77);
    expect(coords.accuracy).toBeUndefined();
  });

  it('accepts coordinates with accuracy', () => {
    const coords: Coordinates = { lat: -7.77, lng: 110.37, accuracy: 3.5 };
    expect(coords.accuracy).toBe(3.5);
  });
});
