import { describe, it, expect } from 'vitest';
import { computeMonthlySummary } from '../computeMonthlySummary';
import type { Attendance } from '../../types';

function makeAttendance(dateISO: string, overrides?: Partial<Attendance>): Attendance {
  return {
    id: 'att-1',
    sessionId: 'session-1',
    userId: 'user-1',
    scanInTime: new Date(dateISO),
    isLate: false,
    lateMinutes: 0,
    ...overrides,
  };
}

describe('computeMonthlySummary', () => {
  it('returns zeros for empty attendances', () => {
    expect(computeMonthlySummary([], 2026, 6))
      .toEqual({ total: 0, onTime: 0, late: 0, percentage: 0 });
  });

  it('counts onTime and late correctly', () => {
    const att = [
      makeAttendance('2026-06-01T10:00:00+07:00', { isLate: false }),
      makeAttendance('2026-06-02T10:00:00+07:00', { isLate: false }),
      makeAttendance('2026-06-03T10:00:00+07:00', { isLate: true, lateMinutes: 20 }),
    ];
    expect(computeMonthlySummary(att, 2026, 6))
      .toEqual({ total: 3, onTime: 2, late: 1, percentage: 66.7 });
  });

  it('filters to specified month only', () => {
    const att = [
      makeAttendance('2026-05-31T10:00:00+07:00'),
      makeAttendance('2026-06-01T10:00:00+07:00'),
    ];
    expect(computeMonthlySummary(att, 2026, 6))
      .toEqual({ total: 1, onTime: 1, late: 0, percentage: 100 });
  });

  it('dedupes same-day attendances', () => {
    const att = [
      makeAttendance('2026-06-01T08:00:00+07:00', { isLate: true }),
      makeAttendance('2026-06-01T16:00:00+07:00', { isLate: false }),
    ];
    expect(computeMonthlySummary(att, 2026, 6))
      .toEqual({ total: 1, onTime: 0, late: 1, percentage: 0 });
  });

  it('handles WIB boundary correctly', () => {
    // 2026-06-01 00:30 WIB = 2026-05-31 17:30 UTC
    const att = [
      makeAttendance('2026-05-31T17:30:00Z', { isLate: false }),
    ];
    expect(computeMonthlySummary(att, 2026, 6))
      .toEqual({ total: 1, onTime: 1, late: 0, percentage: 100 });
  });

  it('ignores attendances without scanInTime', () => {
    const att = [
      { ...makeAttendance('2026-06-01T10:00:00+07:00'), scanInTime: undefined },
    ] as Attendance[];
    expect(computeMonthlySummary(att, 2026, 6))
      .toEqual({ total: 0, onTime: 0, late: 0, percentage: 0 });
  });
});
