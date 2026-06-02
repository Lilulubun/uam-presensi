import { describe, it, expect } from 'vitest';
import { isEarlyExit } from '../attendance-utils';
import type { Attendance, Session } from '../../types';

const baseTeacher: Attendance = {
  id: 'att-1',
  sessionId: 'session-1',
  userId: 'teacher-2',
  scanInTime: new Date('2026-06-02T10:00:00Z'),
  isLate: false,
  lateMinutes: 0,
};

const firstTeacher: Attendance = {
  ...baseTeacher,
  userId: 'teacher-1',
};

const closedSession: Session = {
  id: 'session-1',
  tpaId: 'tpa-001',
  firstTeacherId: 'teacher-1',
  dateOpened: new Date('2026-06-02T10:00:00Z'),
  dateClosed: new Date('2026-06-02T12:00:00Z'),
  isActive: false,
};

const activeSession: Session = {
  ...closedSession,
  isActive: true,
  dateClosed: undefined,
};

describe('isEarlyExit', () => {
  it('returns true for non-first teacher with scanIn, no scanOut, closed session', () => {
    expect(isEarlyExit(baseTeacher, closedSession)).toBe(true);
  });

  it('returns false for first teacher when scanIn set, no scanOut, session closed', () => {
    expect(isEarlyExit(firstTeacher, closedSession)).toBe(false);
  });

  it('returns false when scanOut is set', () => {
    const a: Attendance = { ...baseTeacher, scanOutTime: new Date('2026-06-02T11:00:00Z') };
    expect(isEarlyExit(a, closedSession)).toBe(false);
  });

  it('returns false when session is active', () => {
    expect(isEarlyExit(baseTeacher, activeSession)).toBe(false);
  });

  it('returns false when scanIn is missing', () => {
    const a: Attendance = { ...baseTeacher, scanInTime: undefined };
    expect(isEarlyExit(a, closedSession)).toBe(false);
  });

  it('returns false when session is undefined', () => {
    expect(isEarlyExit(baseTeacher, undefined)).toBe(false);
  });
});
