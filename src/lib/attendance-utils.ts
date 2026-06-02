import type { Attendance, Session } from '../types';

export function isEarlyExit(a: Attendance, session: Session | undefined): boolean {
  if (!session) return false;
  return (
    !!a.scanInTime &&
    !a.scanOutTime &&
    !session.isActive &&
    a.userId !== session.firstTeacherId
  );
}
