import { format, formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { APP_CONFIG } from '../config';

/**
 * Format date and time (DD/MM/YYYY HH:mm)
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd/MM/yyyy HH:mm', { locale: localeId });
}

/**
 * Format time only (HH:mm)
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'HH:mm', { locale: localeId });
}

/**
 * Format date only (DD/MM/YYYY)
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd/MM/yyyy', { locale: localeId });
}

/**
 * Format relative time (e.g., "2 menit yang lalu")
 */
export function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, {
    addSuffix: true,
    locale: localeId,
  });
}

/**
 * Calculate late minutes from session open time
 * Returns 0 if not late
 */
export function calculateLateMinutes(
  checkInTime: Date,
  sessionOpenTime: Date
): number {
  const lateThresholdTime = new Date(
    sessionOpenTime.getTime() + APP_CONFIG.LATE_THRESHOLD_MINUTES * 60000
  );

  if (checkInTime <= lateThresholdTime) {
    return 0;
  }

  const diffMs = checkInTime.getTime() - lateThresholdTime.getTime();
  return Math.floor(diffMs / 60000); // Convert to minutes
}

/**
 * Check if check-in is late
 */
export function isLate(checkInTime: Date, sessionOpenTime: Date): boolean {
  return calculateLateMinutes(checkInTime, sessionOpenTime) > 0;
}

/**
 * Check if two dates are on the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Get start of day
 */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day
 */
export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}
