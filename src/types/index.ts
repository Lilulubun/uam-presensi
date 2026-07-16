// Core Entities
export interface TPA {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
    radius: number;
  };
  staticQRCode: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'pengajar' | 'pengurus';
  nim?: string;
  isActive?: boolean;
}

export interface PengajarTPA {
  userId: string;
  tpaId: string;
  tpaName?: string;
}

export interface Session {
  id: string;
  tpaId: string;
  dateOpened: Date;
  dateClosed?: Date;
  firstTeacherId: string;
  isActive: boolean;
  qrDynamicInToken?: string;
  qrDynamicOutToken?: string;
  qrDynamicInExpiry?: Date;
  qrDynamicOutExpiry?: Date;
  closeNotes?: string;
}

export interface Attendance {
  id: string;
  sessionId: string;
  userId: string;
  scanInTime?: Date;
  scanOutTime?: Date;
  isLate: boolean;
  lateMinutes?: number;
  scanInLocation?: { lat: number; lng: number };
  scanOutLocation?: { lat: number; lng: number };
}

export type IzinStatus = 'pending' | 'approved' | 'rejected';

export interface IzinRequest {
  id: string;
  userId?: string;
  startDate: Date;
  endDate: Date;
  alasan: string;
  status: IzinStatus;
  reviewedBy?: string;
  createdAt: Date;
  reviewedAt?: Date;
  userName?: string;
  reviewedByName?: string;
}

export interface DailyReportRow {
  tgl: Date;
  tpaId: string;
  tpaName: string;
  status: 'hadir' | 'izin' | 'tidak_masuk';
}

// Laporan Presensi (pivot report)
export interface LaporanRow {
  tpaId: string;
  tpaName: string;
  teacherId: string;
  teacherName: string;
  tgl: string;
  sessionIsActive: boolean;
  firstTeacherId: string;
  scanInTime: string | null;
  scanOutTime: string | null;
  isLate: boolean;
  lateMinutes: number | null;
  isIzin: boolean;
}

// QR Token Structure
export interface QRToken {
  token: string;
  sessionId: string;
  type: 'in' | 'out';
  expiry: number; // timestamp
}

// GPS Coordinates
export interface Coordinates {
  lat: number;
  lng: number;
}

// Validation Results
export interface ValidationResult {
  valid: boolean;
  message: string;
  data?: any;
}

// check_in RPC composite return type (Task 1.7 / R2)
export type CheckInReason = 'FIRST_TEACHER_AUTO' | null;
export interface CheckInResult {
  attendance: Attendance;
  reason: CheckInReason;
}

// Store States
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  init: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<ValidationResult>;
  logout: () => Promise<void>;
}

export interface SessionState {
  sessions: Session[];
  activeSession: Session | null;
  loading: boolean;
  init: () => Promise<void>;
  openSession: (tpaId: string, location: Coordinates) => Promise<ValidationResult>;
  openSessionWithExpected: (tpaId: string, location: Coordinates, expectedUserIds: string[]) => Promise<ValidationResult>;
  closeSession: (sessionId: string, location?: Coordinates, notes: string) => Promise<ValidationResult>;
  forceCloseSession: (sessionId: string) => Promise<ValidationResult>;
  refreshQRToken: (sessionId: string, type: 'in' | 'out') => Promise<ValidationResult>;
  getActiveSessionByTPA: (tpaId: string) => Session | null;
}

export interface AttendanceState {
  attendances: Attendance[];
  loading: boolean;
  init: () => Promise<void>;
  checkIn: (sessionId: string, qrToken: string, location: Coordinates) => Promise<ValidationResult>;
  checkOut: (sessionId: string, qrToken: string, location: Coordinates) => Promise<ValidationResult>;
  getAttendanceBySession: (sessionId: string) => Attendance[];
  getAttendanceByUser: (userId: string) => Attendance[];
}
