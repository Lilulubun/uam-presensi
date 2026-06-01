import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AttendanceState, Attendance, Coordinates, ValidationResult } from '../types';
import { useSessionStore } from './sessionStore';
import { decodeQRData, isTokenExpired } from '../lib/qr-utils';
import { getCurrentLocation, isWithinRadius } from '../lib/gps-utils';
import { calculateLateMinutes, isLate } from '../lib/date-utils';
import { APP_CONFIG } from '../config';
import { getTpaById } from '../lib/mock-data';

export const useAttendanceStore = create<AttendanceState>()(
  persist(
    (set, get) => ({
      attendances: [],

      recordFirstTeacherAttendance: async (
        sessionId: string,
        userId: string,
        location: Coordinates
      ): Promise<ValidationResult> => {
        const state = get();
        const now = new Date();
        
        const newAttendance: Attendance = {
          id: crypto.randomUUID(),
          sessionId,
          userId,
          scanInTime: now,
          scanInLocation: location,
          isLate: false, // First teacher is never late
          lateMinutes: 0,
        };

        set({ attendances: [...state.attendances, newAttendance] });

        return {
          valid: true,
          message: 'Presensi pengajar pertama berhasil dicatat',
          data: newAttendance,
        };
      },

      checkIn: async (
        sessionId: string,
        userId: string,
        qrToken: string,
        location: Coordinates
      ): Promise<ValidationResult> => {
        const state = get();
        const sessionState = useSessionStore.getState();

        // Find session
        const session = sessionState.sessions.find((s) => s.id === sessionId);
        if (!session) {
          return {
            valid: false,
            message: 'Sesi tidak ditemukan',
          };
        }

        if (!session.isActive) {
          return {
            valid: false,
            message: 'Sesi sudah ditutup',
          };
        }

        // Validate QR token
        if (session.qrDynamicInToken !== qrToken) {
          return {
            valid: false,
            message: 'QR code tidak valid',
          };
        }

        if (
          session.qrDynamicInExpiry &&
          isTokenExpired(new Date(session.qrDynamicInExpiry).getTime())
        ) {
          return {
            valid: false,
            message: 'QR code sudah kadaluarsa',
          };
        }

        // Check if user already checked in
        const existingAttendance = state.attendances.find(
          (a) => a.sessionId === sessionId && a.userId === userId
        );

        if (existingAttendance?.scanInTime) {
          return {
            valid: false,
            message: 'Anda sudah melakukan presensi masuk',
            data: existingAttendance,
          };
        }

        // Validate GPS location (except for first teacher)
        if (userId !== session.firstTeacherId) {
          const tpa = getTpaById(session.tpaId);
          const tpaLocation = tpa
            ? { lat: tpa.location.lat, lng: tpa.location.lng }
            : { lat: 0, lng: 0 };

          if (
            !isWithinRadius(location, tpaLocation, APP_CONFIG.GPS_RADIUS_TOLERANCE)
          ) {
            return {
              valid: false,
              message: `Anda berada di luar radius ${APP_CONFIG.GPS_RADIUS_TOLERANCE}m dari TPA`,
            };
          }
        }

        // Calculate late status (new Date() handles both Date objects and ISO strings from localStorage)
        const now = new Date();
        const sessionOpenedAt = new Date(session.dateOpened);
        const late = userId !== session.firstTeacherId && isLate(now, sessionOpenedAt);
        const lateMinutes = late ? calculateLateMinutes(now, sessionOpenedAt) : 0;

        // Create or update attendance record
        if (existingAttendance) {
          // Update existing record
          const updatedAttendance: Attendance = {
            ...existingAttendance,
            scanInTime: now,
            scanInLocation: location,
            isLate: late,
            lateMinutes: lateMinutes,
          };

          const newAttendances = state.attendances.map((a) =>
            a.id === existingAttendance.id ? updatedAttendance : a
          );

          set({ attendances: newAttendances });

          return {
            valid: true,
            message: 'Presensi masuk berhasil',
            data: updatedAttendance,
          };
        } else {
          // Create new attendance record
          const newAttendance: Attendance = {
            id: crypto.randomUUID(),
            sessionId,
            userId,
            scanInTime: now,
            scanInLocation: location,
            isLate: late,
            lateMinutes: lateMinutes,
          };

          set({ attendances: [...state.attendances, newAttendance] });

          return {
            valid: true,
            message: 'Presensi masuk berhasil',
            data: newAttendance,
          };
        }
      },

      checkOut: async (
        sessionId: string,
        userId: string,
        qrToken: string,
        location: Coordinates
      ): Promise<ValidationResult> => {
        const state = get();
        const sessionState = useSessionStore.getState();

        // Find session
        const session = sessionState.sessions.find((s) => s.id === sessionId);
        if (!session) {
          return {
            valid: false,
            message: 'Sesi tidak ditemukan',
          };
        }

        // Validate QR token
        if (session.qrDynamicOutToken !== qrToken) {
          return {
            valid: false,
            message: 'QR code tidak valid',
          };
        }

        if (
          session.qrDynamicOutExpiry &&
          isTokenExpired(new Date(session.qrDynamicOutExpiry).getTime())
        ) {
          return {
            valid: false,
            message: 'QR code sudah kadaluarsa',
          };
        }

        // Validate GPS location
        const tpa = getTpaById(session.tpaId);
        const tpaLocation = tpa
          ? { lat: tpa.location.lat, lng: tpa.location.lng }
          : { lat: 0, lng: 0 };

        if (
          !isWithinRadius(location, tpaLocation, APP_CONFIG.GPS_RADIUS_TOLERANCE)
        ) {
          return {
            valid: false,
            message: `Anda berada di luar radius ${APP_CONFIG.GPS_RADIUS_TOLERANCE}m dari TPA`,
          };
        }

        // Find attendance record
        const attendance = state.attendances.find(
          (a) => a.sessionId === sessionId && a.userId === userId
        );

        if (!attendance) {
          return {
            valid: false,
            message: 'Anda belum melakukan presensi masuk',
          };
        }

        if (attendance.scanOutTime) {
          return {
            valid: false,
            message: 'Anda sudah melakukan presensi keluar',
            data: attendance,
          };
        }

        // Update attendance with check-out info
        const updatedAttendance: Attendance = {
          ...attendance,
          scanOutTime: new Date(),
          scanOutLocation: location,
        };

        const newAttendances = state.attendances.map((a) =>
          a.id === attendance.id ? updatedAttendance : a
        );

        set({ attendances: newAttendances });

        return {
          valid: true,
          message: 'Presensi keluar berhasil',
          data: updatedAttendance,
        };
      },

      getAttendanceBySession: (sessionId: string): Attendance[] => {
        return get().attendances.filter((a) => a.sessionId === sessionId);
      },

      getAttendanceByUser: (userId: string): Attendance[] => {
        return get().attendances.filter((a) => a.userId === userId);
      },
    }),
    {
      name: 'uam-attendances',
      partialize: (state) => ({
        attendances: state.attendances,
      }),
    }
  )
);
