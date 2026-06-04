import type { Attendance, Session } from '../types';
import { toDate } from './date-utils';

const UTC_7_MS = 7 * 60 * 60 * 1000;

function toJakartaDate(date: Date): string {
  const ms = date.getTime() + UTC_7_MS;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function computeStreak(attendances: Attendance[], sessions: Session[]): number {
  const now = new Date();

  const teachingDays = [...new Set(
    sessions
      .map((s) => toDate(s.dateOpened))
      .filter((d): d is Date => d !== null && d <= now)
      .map((d) => toJakartaDate(d)),
  )].sort().reverse();

  if (teachingDays.length === 0) return 0;

  const attendedDays = new Set(
    attendances
      .map((a) => toDate(a.scanInTime))
      .filter((d): d is Date => d !== null)
      .map((d) => toJakartaDate(d)),
  );

  let streak = 0;
  for (const day of teachingDays) {
    if (attendedDays.has(day)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
