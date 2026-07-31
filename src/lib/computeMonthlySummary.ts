import type { Attendance } from '../types';
import type { IzinRequest } from '../types';
import { toDate, toJakartaDate, toJakartaMonth } from './date-utils';

export interface MonthlySummary {
  total: number;
  onTime: number;
  late: number;
  percentage: number;
}

export function computeMonthlySummary(
  attendances: Attendance[],
  year: number,
  month: number,
): MonthlySummary {
  const target = `${year}-${String(month).padStart(2, '0')}`;

  const seen = new Set<string>();
  let onTime = 0;
  let late = 0;

  for (const a of attendances) {
    const dt = toDate(a.scanInTime);
    if (!dt) continue;
    if (toJakartaMonth(dt) !== target) continue;

    const dateKey = toJakartaDate(dt);
    if (seen.has(dateKey)) continue;
    seen.add(dateKey);

    if (a.isLate) {
      late++;
    } else {
      onTime++;
    }
  }

  const total = seen.size;
  const percentage = total > 0
    ? Math.round((onTime / total) * 1000) / 10
    : 0;

  return { total, onTime, late, percentage };
}

export interface ExpectedSummary {
  expectedCount: number;
  excusedCount: number;
  requiredCount: number;
  actualHadir: number;
  targetMet: boolean;
}

export function computeMonthlySummaryWithExpected(
  attendances: Attendance[],
  expectedSessionIds: Set<string>,
  approvedIzins: IzinRequest[],
  year: number,
  month: number,
  sessionsList: { id: string; dateOpened: Date }[] = []
): ExpectedSummary {
  const target = `${year}-${String(month).padStart(2, '0')}`;
  const sessionsMap = new Map(sessionsList.map(s => [s.id, s]));

  // Calculate excused sessions due to overlapping approved izin
  let excusedCount = 0;
  for (const sId of expectedSessionIds) {
    const s = sessionsMap.get(sId);
    if (!s) continue;

    const sessionDate = new Date(s.dateOpened);
    const isExcused = approvedIzins.some(izin => {
      const start = new Date(izin.startDate);
      const end = new Date(izin.endDate);
      // Set hours to 0 to compare purely by date
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      return sessionDate >= start && sessionDate <= end;
    });

    if (isExcused) {
      excusedCount++;
    }
  }

  const expectedCount = expectedSessionIds.size;
  const adjustedExpected = Math.max(0, expectedCount - excusedCount);
  const requiredCount = Math.ceil(adjustedExpected * 0.75);

  // Actual attendance count — only for expected sessions this month
  let actualHadir = 0;
  for (const a of attendances) {
    const dt = toDate(a.scanInTime);
    if (!dt) continue;
    if (toJakartaMonth(dt) !== target) continue;
    if (a.scanInTime && expectedSessionIds.has(a.sessionId)) {
      actualHadir++;
    }
  }

  const targetMet = actualHadir >= requiredCount;

  return {
    expectedCount,
    excusedCount,
    requiredCount,
    actualHadir,
    targetMet
  };
}
