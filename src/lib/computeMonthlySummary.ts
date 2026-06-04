import type { Attendance } from '../types';
import { toDate } from './date-utils';

const UTC_7_MS = 7 * 60 * 60 * 1000;

function toJakartaMonth(date: Date): string {
  const ms = date.getTime() + UTC_7_MS;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function toJakartaDate(date: Date): string {
  const ms = date.getTime() + UTC_7_MS;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
