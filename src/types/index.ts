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
  password?: string; // For mock auth only
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
  login: (email: string, password: string) => Promise<ValidationResult>;
  logout: () => void;
}

export interface SessionState {
  sessions: Session[];
  activeSession: Session | null;
  openSession: (tpaId: string, userId: string, location: Coordinates) => Promise<ValidationResult>;
  closeSession: (sessionId: string) => Promise<ValidationResult>;
  refreshQRToken: (sessionId: string, type: 'in' | 'out') => void;
  getActiveSessionByTPA: (tpaId: string) => Session | null;
}

export interface AttendanceState {
  attendances: Attendance[];
  recordFirstTeacherAttendance: (sessionId: string, userId: string, location: Coordinates) => Promise<ValidationResult>;
  checkIn: (sessionId: string, userId: string, qrToken: string, location: Coordinates) => Promise<ValidationResult>;
  checkOut: (sessionId: string, userId: string, qrToken: string, location: Coordinates) => Promise<ValidationResult>;
  getAttendanceBySession: (sessionId: string) => Attendance[];
  getAttendanceByUser: (userId: string) => Attendance[];
}
