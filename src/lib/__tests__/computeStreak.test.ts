import { describe, it, expect } from 'vitest';
import { computeStreak } from '../computeStreak';
import type { Attendance, Session } from '../../types';

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

function makeSession(dateISO: string, overrides?: Partial<Session>): Session {
  return {
    id: 'session-1',
    tpaId: 'tpa-1',
    dateOpened: new Date(dateISO),
    firstTeacherId: 'user-1',
    isActive: false,
    ...overrides,
  };
}

describe('computeStreak', () => {
  it('returns 0 for empty attendances', () => {
    const sessions = [makeSession('2026-06-01T10:00:00+07:00')];
    expect(computeStreak([], sessions)).toBe(0);
  });

  it('returns 1 if teacher attended the only teaching day', () => {
    const sessions = [makeSession('2026-06-01T10:00:00+07:00')];
    const att = [makeAttendance('2026-06-01T10:00:00+07:00')];
    expect(computeStreak(att, sessions)).toBe(1);
  });

  it('returns 3 for 3 consecutive teaching days all attended', () => {
    const sessions = [
      makeSession('2026-06-01T10:00:00+07:00', { id: 's1' }),
      makeSession('2026-06-02T10:00:00+07:00', { id: 's2' }),
      makeSession('2026-06-03T10:00:00+07:00', { id: 's3' }),
    ];
    const att = [
      makeAttendance('2026-06-01T10:00:00+07:00', { sessionId: 's1' }),
      makeAttendance('2026-06-02T10:00:00+07:00', { sessionId: 's2' }),
      makeAttendance('2026-06-03T10:00:00+07:00', { sessionId: 's3' }),
    ];
    expect(computeStreak(att, sessions)).toBe(3);
  });

  it('returns 0 if most recent teaching day was not attended', () => {
    // Teaching days: Senin, Selasa, Rabu
    // Attended: Senin, Selasa (missed Rabu)
    const sessions = [
      makeSession('2026-06-01T10:00:00+07:00', { id: 's1' }),
      makeSession('2026-06-02T10:00:00+07:00', { id: 's2' }),
      makeSession('2026-06-03T10:00:00+07:00', { id: 's3' }),
    ];
    const att = [
      makeAttendance('2026-06-01T10:00:00+07:00', { sessionId: 's1' }),
      makeAttendance('2026-06-02T10:00:00+07:00', { sessionId: 's2' }),
    ];
    // Streak = 0 because Rabu (most recent teaching day) was missed
    expect(computeStreak(att, sessions)).toBe(0);
  });

  it('counts streak across non-consecutive calendar days when TPA skips days', () => {
    // TPA operates Mon, Tue, Thu only (Wed skipped)
    const sessions = [
      makeSession('2026-06-01T10:00:00+07:00', { id: 's1' }), // Mon
      makeSession('2026-06-02T10:00:00+07:00', { id: 's2' }), // Tue
      makeSession('2026-06-04T10:00:00+07:00', { id: 's3' }), // Thu
    ];
    const att = [
      makeAttendance('2026-06-01T10:00:00+07:00', { sessionId: 's1' }), // Mon ✅
      makeAttendance('2026-06-02T10:00:00+07:00', { sessionId: 's2' }), // Tue ✅
      makeAttendance('2026-06-04T10:00:00+07:00', { sessionId: 's3' }), // Thu ✅
    ];
    // All teaching days attended consecutively (Wed gap doesn't matter)
    expect(computeStreak(att, sessions)).toBe(3);
  });

  it('resets streak when a teaching day is missed in the middle', () => {
    // Teaching days: Mon, Tue, Wed, Thu
    // Attended: Mon, Tue, Thu (missed Wed)
    const sessions = [
      makeSession('2026-06-01T10:00:00+07:00', { id: 's1' }), // Mon
      makeSession('2026-06-02T10:00:00+07:00', { id: 's2' }), // Tue
      makeSession('2026-06-03T10:00:00+07:00', { id: 's3' }), // Wed
      makeSession('2026-06-04T10:00:00+07:00', { id: 's4' }), // Thu
    ];
    const att = [
      makeAttendance('2026-06-01T10:00:00+07:00', { sessionId: 's1' }),
      makeAttendance('2026-06-02T10:00:00+07:00', { sessionId: 's2' }),
      makeAttendance('2026-06-04T10:00:00+07:00', { sessionId: 's4' }),
    ];
    // Streak = 0 because Thu (most recent) was attended, but Wed (previous teaching day) was missed
    expect(computeStreak(att, sessions)).toBe(1);
  });

  it('dedupes same-day attendances', () => {
    const sessions = [
      makeSession('2026-06-01T10:00:00+07:00', { id: 's1' }),
      makeSession('2026-06-02T10:00:00+07:00', { id: 's2' }),
    ];
    const att = [
      makeAttendance('2026-06-01T10:00:00+07:00', { sessionId: 's1' }),
      makeAttendance('2026-06-02T08:00:00+07:00', { sessionId: 's2' }),
      makeAttendance('2026-06-02T16:00:00+07:00', { sessionId: 's2' }),
    ];
    expect(computeStreak(att, sessions)).toBe(2);
  });

  it('ignores future dates', () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const sessions = [
      makeSession('2026-06-01T10:00:00+07:00', { id: 's1' }),
      makeSession('2026-06-02T10:00:00+07:00', { id: 's2' }),
      makeSession(future.toISOString(), { id: 's3' }),
    ];
    const att = [
      makeAttendance('2026-06-01T10:00:00+07:00', { sessionId: 's1' }),
      makeAttendance('2026-06-02T10:00:00+07:00', { sessionId: 's2' }),
    ];
    // Future session is not counted as a teaching day yet
    // Streak = 2 because the two past sessions were both attended
    expect(computeStreak(att, sessions)).toBe(2);
  });

  it('handles WIB date boundary (00:00 WIB = prev day UTC)', () => {
    // 2026-06-03 00:30 WIB = 2026-06-02 17:30 UTC
    const sessions = [
      makeSession('2026-06-02T10:00:00+07:00', { id: 's1' }),
      makeSession('2026-06-03T10:00:00+07:00', { id: 's2' }),
    ];
    const att = [
      makeAttendance('2026-06-02T17:30:00Z'),       // UTC, = 2026-06-03 00:30 WIB
      makeAttendance('2026-06-03T10:00:00+07:00'),  // WIB, same day as above
    ];
    // Both attendances on same WIB day (June 3), deduped to 1
    // Teaching days: June 2 (session s1) and June 3 (session s2)
    // Teacher attended only June 3 → missed June 2 → streak = 0
    // Actually wait: session s1 is June 2 WIB, session s2 is June 3 WIB
    // Teacher attended at 2026-06-02 17:30 UTC = 2026-06-03 00:30 WIB → that's June 3 WIB
    // Teacher also attended at 2026-06-03 10:00+07:00 → that's also June 3 WIB
    // So teacher only attended June 3 WIB, missed June 2 WIB
    // Most recent teaching day is June 3, teacher attended → streak starts
    // Previous teaching day June 2 → not attended → break
    // Streak = 1
    expect(computeStreak(att, sessions)).toBe(1);
  });

  it('returns 0 when all sessions are in the future', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const sessions = [makeSession(future.toISOString())];
    const att = [makeAttendance(future.toISOString())];
    expect(computeStreak(att, sessions)).toBe(0);
  });

  it('ignores attendances without scanInTime', () => {
    const sessions = [makeSession('2026-06-01T10:00:00+07:00')];
    const att = [
      { ...makeAttendance('2026-06-01T10:00:00+07:00'), scanInTime: undefined },
    ] as Attendance[];
    expect(computeStreak(att, sessions)).toBe(0);
  });

  it('returns streak of 1 when user scenario: attended Mon Tue, no session Wed, session Thu missed', () => {
    // User scenario: Senin Selasa ada jadwal dan hadir, Rabu tidak ada jadwal,
    // Kamis ada jadwal tapi tidak hadir
    const sessions = [
      makeSession('2026-06-01T10:00:00+07:00', { id: 's1' }), // Mon
      makeSession('2026-06-02T10:00:00+07:00', { id: 's2' }), // Tue
      makeSession('2026-06-04T10:00:00+07:00', { id: 's4' }), // Thu (Rabu libur)
    ];
    const att = [
      makeAttendance('2026-06-01T10:00:00+07:00', { sessionId: 's1' }), // Mon ✅
      makeAttendance('2026-06-02T10:00:00+07:00', { sessionId: 's2' }), // Tue ✅
      // Thu → not attended
    ];
    // Teaching days (desc): Thu, Tue, Mon
    // Thu: not attended → break → streak = 0
    expect(computeStreak(att, sessions)).toBe(0);
  });
});
