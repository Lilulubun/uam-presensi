import type { Attendance } from '../types';
import { toDate, toJakartaDate } from './date-utils';

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

  const nowJakarta = toJakartaDate(new Date());
  const lastJakarta = toJakartaDate(maxScanIn);

  const nowMs = new Date(nowJakarta + 'T00:00:00').getTime();
  const lastMs = new Date(lastJakarta + 'T00:00:00').getTime();
  const daysSince = Math.floor((nowMs - lastMs) / 86_400_000);

  return {
    isInactive: daysSince > thresholdDays,
    lastActive: maxScanIn.toISOString(),
    daysSince,
  };
}
