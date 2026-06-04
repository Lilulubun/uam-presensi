import type { Attendance } from '../types';
import { toDate } from './date-utils';

const UTC_7_MS = 7 * 60 * 60 * 1000;

export interface InactiveAlert {
  isInactive: boolean;
  lastActive: string | null;
  daysSince: number | null;
}

export function computeInactiveAlert(
  attendances: Attendance[],
  userId: string,
  thresholdDays: number = 14,
): InactiveAlert {
  const userAttendances = attendances.filter(
    (a) => a.userId === userId && a.scanInTime,
  );

  if (userAttendances.length === 0) {
    return { isInactive: true, lastActive: null, daysSince: null };
  }

  const maxScanIn = userAttendances.reduce<Date | null>((latest, a) => {
    const dt = toDate(a.scanInTime);
    if (!dt) return latest;
    if (!latest || dt > latest) return dt;
    return latest;
  }, null);

  if (!maxScanIn) {
    return { isInactive: true, lastActive: null, daysSince: null };
  }

  const nowJakarta = new Date(Date.now() + UTC_7_MS);
  const lastJakarta = new Date(maxScanIn.getTime() + UTC_7_MS);

  const diffMs = nowJakarta.getTime() - lastJakarta.getTime();
  const daysSince = Math.floor(diffMs / 86_400_000);

  return {
    isInactive: daysSince > thresholdDays,
    lastActive: maxScanIn.toISOString(),
    daysSince,
  };
}
