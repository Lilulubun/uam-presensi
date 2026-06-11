import type { Attendance } from '../types';
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
