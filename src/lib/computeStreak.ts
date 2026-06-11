import type { Attendance, Session } from '../types';
import { toDate, toJakartaDate } from './date-utils';

export function computeStreak(attendances: Attendance[], sessions: Session[]): number {
  const now = new Date();
  const todayStr = toJakartaDate(now);

  const attendedDays = new Set(
    attendances
      .map((a) => toDate(a.scanInTime))
      .filter((d): d is Date => d !== null)
      .map((d) => toJakartaDate(d)),
  );

  const teachingDays = [...new Set(
    sessions
      .map((s) => toDate(s.dateOpened))
      .filter((d): d is Date => d !== null && d <= now)
      .map((d) => toJakartaDate(d)),
  )]
    .filter((day) => day !== todayStr || attendedDays.has(day))
    .sort()
    .reverse();

  if (teachingDays.length === 0) return 0;

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
