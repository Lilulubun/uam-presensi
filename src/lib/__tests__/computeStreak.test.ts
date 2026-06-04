import { describe, it, expect } from 'vitest';
import { computeStreak } from '../computeStreak';
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

describe('computeStreak', () => {
  it('returns 0 for empty attendances', () => {
    expect(computeStreak([])).toBe(0);
  });

  it('returns 1 for single attendance', () => {
    const att = [makeAttendance('2026-06-01T10:00:00+07:00')];
    expect(computeStreak(att)).toBe(1);
  });

  it('returns 3 for 3 consecutive days', () => {
    const att = [
      makeAttendance('2026-06-01T10:00:00+07:00'),
      makeAttendance('2026-06-02T10:00:00+07:00'),
      makeAttendance('2026-06-03T10:00:00+07:00'),
    ];
    expect(computeStreak(att)).toBe(3);
  });

  it('resets streak on gap (Senin -> Rabu, skip Selasa)', () => {
    const att = [
      makeAttendance('2026-06-01T10:00:00+07:00'),
      makeAttendance('2026-06-03T10:00:00+07:00'),
    ];
    expect(computeStreak(att)).toBe(1);
  });

  it('dedupes same-day attendances', () => {
    const att = [
      makeAttendance('2026-06-01T10:00:00+07:00'),
      makeAttendance('2026-06-02T08:00:00+07:00'),
      makeAttendance('2026-06-02T16:00:00+07:00'),
    ];
    expect(computeStreak(att)).toBe(2);
  });

  it('ignores future dates', () => {
    const att = [
      makeAttendance('2026-06-01T10:00:00+07:00'),
      makeAttendance('2026-06-02T10:00:00+07:00'),
      makeAttendance('2026-06-10T10:00:00+07:00'),
    ];
    expect(computeStreak(att)).toBe(2);
  });

  it('handles WIB date boundary (00:00 WIB = prev day UTC)', () => {
    // 2026-06-03 00:30 WIB = 2026-06-02 17:30 UTC
    const att = [
      makeAttendance('2026-06-02T17:30:00Z'), // UTC, = 2026-06-03 00:30 WIB
      makeAttendance('2026-06-03T10:00:00+07:00'), // WIB, same day as above
    ];
    expect(computeStreak(att)).toBe(1);
  });

  it('returns 0 when only future dates exist', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const att = [makeAttendance(future.toISOString())];
    expect(computeStreak(att)).toBe(0);
  });

  it('ignores attendances without scanInTime', () => {
    const att = [
      { ...makeAttendance('2026-06-01T10:00:00+07:00'), scanInTime: undefined },
    ] as Attendance[];
    expect(computeStreak(att)).toBe(0);
  });
});
