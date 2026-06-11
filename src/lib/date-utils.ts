const TZ = 'Asia/Jakarta';

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function jakartaParts(date: Date): Intl.DateTimeFormatPart[] {
  return dateTimeFmt.formatToParts(date);
}

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)!.value;
}

export function toJakartaDate(date: Date): string {
  const parts = jakartaParts(date);
  const y = partValue(parts, 'year');
  const m = partValue(parts, 'month');
  const d = partValue(parts, 'day');
  return `${y}-${m}-${d}`;
}

export function toJakartaMonth(date: Date): string {
  const parts = jakartaParts(date);
  const y = partValue(parts, 'year');
  const m = partValue(parts, 'month');
  return `${y}-${m}`;
}

export function toDate(value: Date | string | undefined | null): Date | null {
  if (!value) return null;
  const d = typeof value === 'string' ? new Date(value) : value;
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format date and time (DD/MM/YYYY HH:mm) in Asia/Jakarta
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const parts = dateTimeFmt.formatToParts(d);
  const day = partValue(parts, 'day');
  const month = partValue(parts, 'month');
  const year = partValue(parts, 'year');
  const hour = partValue(parts, 'hour');
  const minute = partValue(parts, 'minute');
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

/**
 * Format time only (HH:mm) in Asia/Jakarta
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return timeFmt.format(d);
}

/**
 * Format date only (DD/MM/YYYY) in Asia/Jakarta
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return dateFmt.format(d);
}

/**
 * Check if two dates are on the same day in Asia/Jakarta
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return toJakartaDate(date1) === toJakartaDate(date2);
}

const shortDateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
});

const dayNameFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ,
  weekday: 'short',
});

const monthYearFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ,
  month: 'long',
  year: 'numeric',
});

const dateIdFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const dateIdShortFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ,
  day: 'numeric',
  month: 'short',
});

/** Format a date string (YYYY-MM-DD) as "dd/MM" in Jakarta */
export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00+07:00');
  const parts = shortDateFmt.formatToParts(d);
  const day = partValue(parts, 'day');
  const month = partValue(parts, 'month');
  return `${day}/${month}`;
}

/** Abbreviated day name (Sen, Sel, etc.) in Jakarta */
export function formatDayName(date: Date): string {
  return dayNameFmt.format(date);
}

/** "Juni 2026" in Jakarta */
export function formatMonthYear(date: Date): string {
  return monthYearFmt.format(date);
}

/** "2 Jun 2026" in Jakarta */
export function formatDateId(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return dateIdFmt.format(d);
}

/** "2 Jun" in Jakarta (no year) */
export function formatDateIdShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return dateIdShortFmt.format(d);
}

/** Get Jakarta year and month (0-based) from now */
export function jakartaNow(): { year: number; month: number } {
  const parts = jakartaParts(new Date());
  return {
    year: parseInt(partValue(parts, 'year'), 10),
    month: parseInt(partValue(parts, 'month'), 10) - 1,
  };
}

/** ISO date strings for the first and last day of a given month */
export function monthBounds(year: number, month: number): { from: string; to: string } {
  const m = String(month + 1).padStart(2, '0');
  const from = `${year}-${m}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${m}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}
