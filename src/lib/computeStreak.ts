import type { Attendance } from '../types';

const MS_PER_DAY = 86_400_000;
const UTC_7_MS = 7 * 60 * 60 * 1000;

function toJakartaDate(date: Date): string {
  const ms = date.getTime() + UTC_7_MS;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseJakartaDate(str: string): number {
  return new Date(str + 'T00:00:00+07:00').getTime();
}

export function computeStreak(attendances: Attendance[]): number {
  const now = new Date();

  const dates = attendances
    .filter((a) => a.scanInTime && a.scanInTime <= now)
    .map((a) => toJakartaDate(a.scanInTime!));

  if (dates.length === 0) return 0;

  const unique = [...new Set(dates)].sort().reverse();

  let streak = 1;
  for (let i = 1; i < unique.length; i++) {
    const prev = parseJakartaDate(unique[i - 1]);
    const curr = parseJakartaDate(unique[i]);
    if (prev - curr === MS_PER_DAY) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
