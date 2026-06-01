import type { Session, Attendance } from '../types';
import { MOCK_USERS, MOCK_TPAS } from './mock-data';
import { calculateLateMinutes, isLate } from './date-utils';

// Stable teacher-to-TPA assignments for realistic rotation
const TEACHER_TPA_MAP: Record<string, string[]> = {
  'user-001': ['tpa-001', 'tpa-005', 'tpa-009'], // Budi: Al-Fath, Al-Iman, Al-Jami'
  'user-002': ['tpa-002', 'tpa-006', 'tpa-010'], // Siti: Adz-Dzikro, Ananda, Ulil Albab
  'user-003': ['tpa-003', 'tpa-007', 'tpa-011'], // Ahmad: Al-Hidayah Besirejo, Az-Zahra, Sholihin
};

// Seeded random to keep data stable across reloads
function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export function generateSeedData(): { sessions: Session[]; attendances: Attendance[] } {
  const sessions: Session[] = [];
  const attendances: Attendance[] = [];

  const teachers = MOCK_USERS.filter((u) => u.role === 'pengajar');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let daysAgo = 28; daysAgo >= 1; daysAgo--) {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const rand = seededRand(date.getTime());

    teachers.forEach((teacher, teacherIdx) => {
      // ~85% chance teacher works on this weekday
      if (rand() > 0.85) return;

      // Rotate TPA based on week number
      const weekNum = Math.floor(daysAgo / 7);
      const tpaOptions = TEACHER_TPA_MAP[teacher.id] ?? ['tpa-001'];
      const tpaId = tpaOptions[weekNum % tpaOptions.length];
      const tpa = MOCK_TPAS.find((t) => t.id === tpaId) ?? MOCK_TPAS[teacherIdx];

      // Session opens at 15:30 ± 5min
      const sessionOpen = new Date(date);
      sessionOpen.setHours(15, 25 + Math.floor(rand() * 10), 0, 0);

      // Session closes at ~17:30
      const sessionClose = new Date(date);
      sessionClose.setHours(17, 20 + Math.floor(rand() * 20), 0, 0);

      const session: Session = {
        id: `seed-${date.toISOString().slice(0, 10)}-${teacher.id}`,
        tpaId: tpa.id,
        firstTeacherId: teacher.id,
        dateOpened: sessionOpen,
        dateClosed: sessionClose,
        isActive: false,
        qrDynamicInToken: `expired-${teacher.id}-in`,
        qrDynamicOutToken: `expired-${teacher.id}-out`,
        qrDynamicInExpiry: sessionClose,
        qrDynamicOutExpiry: sessionClose,
      };
      sessions.push(session);

      // First teacher checks in just before session opens
      const selfCheckIn = new Date(sessionOpen);
      selfCheckIn.setMinutes(selfCheckIn.getMinutes() - 3 - Math.floor(rand() * 8));

      attendances.push({
        id: `seed-att-${session.id}-self`,
        sessionId: session.id,
        userId: teacher.id,
        scanInTime: selfCheckIn,
        scanOutTime: sessionClose,
        isLate: false,
        lateMinutes: 0,
        scanInLocation: { lat: tpa.location.lat, lng: tpa.location.lng },
        scanOutLocation: { lat: tpa.location.lat, lng: tpa.location.lng },
      });

      // Other teachers may join this session
      teachers
        .filter((t) => t.id !== teacher.id)
        .forEach((other) => {
          if (rand() > 0.65) return; // 65% chance they join

          // Check-in offset: -5 to +30 minutes from session open
          const offset = Math.floor(rand() * 35) - 5;
          const checkInTime = new Date(sessionOpen);
          checkInTime.setMinutes(sessionOpen.getMinutes() + offset);

          const late = isLate(checkInTime, sessionOpen);
          const lateMinutes = late ? calculateLateMinutes(checkInTime, sessionOpen) : 0;

          // 92% check out
          const didCheckOut = rand() > 0.08;
          const checkOutTime = didCheckOut ? new Date(sessionClose) : undefined;

          attendances.push({
            id: `seed-att-${session.id}-${other.id}`,
            sessionId: session.id,
            userId: other.id,
            scanInTime: checkInTime,
            scanOutTime: checkOutTime,
            isLate: late,
            lateMinutes,
            scanInLocation: { lat: tpa.location.lat, lng: tpa.location.lng },
            scanOutLocation: didCheckOut
              ? { lat: tpa.location.lat, lng: tpa.location.lng }
              : undefined,
          });
        });
    });
  }

  return { sessions, attendances };
}

const SEED_VERSION_KEY = 'uam-seed-v1';

export function shouldSeed(): boolean {
  return !localStorage.getItem(SEED_VERSION_KEY);
}

export function markSeeded(): void {
  localStorage.setItem(SEED_VERSION_KEY, '1');
}
