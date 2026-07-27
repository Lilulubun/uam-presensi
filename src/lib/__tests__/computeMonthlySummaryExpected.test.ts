import { describe, it, expect } from 'vitest';
import { computeMonthlySummaryWithExpected } from '../computeMonthlySummary';
import type { Attendance, IzinRequest } from '../../types';

describe('computeMonthlySummaryWithExpected', () => {
  const t1 = new Date('2026-08-01T08:00:00Z');
  const t2 = new Date('2026-08-02T08:00:00Z');

  it('calculates target correctly without approved izin', () => {
    const attendances: Attendance[] = [
      { id: '1', sessionId: 's1', userId: 'u1', scanInTime: t1, isLate: false },
      { id: '2', sessionId: 's2', userId: 'u1', scanInTime: t2, isLate: false },
    ];
    // u1 expected on s1, s2, s3 (3 sessions)
    const expectedSessionIds = new Set(['s1', 's2', 's3']);
    const approvedIzins: IzinRequest[] = [];

    const summary = computeMonthlySummaryWithExpected(
      attendances,
      expectedSessionIds,
      approvedIzins,
      2026,
      8
    );

    // expected = 3
    // excused = 0
    // adjustedExpected = 3
    // required = ceil(3 * 0.75) = 3
    // actual hadir = 2 (s1, s2)
    expect(summary.expectedCount).toBe(3);
    expect(summary.excusedCount).toBe(0);
    expect(summary.requiredCount).toBe(3);
    expect(summary.actualHadir).toBe(2);
    expect(summary.targetMet).toBe(false);
  });

  it('calculates target correctly with approved overlapping izin', () => {
    const attendances: Attendance[] = [
      { id: '1', sessionId: 's1', userId: 'u1', scanInTime: t1, isLate: false },
    ];
    // expected on s1, s2
    const expectedSessionIds = new Set(['s1', 's2']);
    
    // Izin overlapping s2 (2026-08-02)
    const approvedIzins: IzinRequest[] = [
      {
        id: 'iz1',
        userId: 'u1',
        startDate: new Date('2026-08-02'),
        endDate: new Date('2026-08-02'),
        status: 'approved',
        alasan: 'Sakit',
        createdAt: new Date()
      }
    ];

    const summary = computeMonthlySummaryWithExpected(
      attendances,
      expectedSessionIds,
      approvedIzins,
      2026,
      8,
      [
        { id: 's1', dateOpened: t1 },
        { id: 's2', dateOpened: t2 }
      ]
    );

    // expected = 2
    // excused = 1 (s2 overlap izin)
    // adjustedExpected = 1
    // required = ceil(1 * 0.75) = 1
    // actual hadir = 1 (s1)
    expect(summary.expectedCount).toBe(2);
    expect(summary.excusedCount).toBe(1);
    expect(summary.requiredCount).toBe(1);
    expect(summary.actualHadir).toBe(1);
    expect(summary.targetMet).toBe(true);
  });
});
