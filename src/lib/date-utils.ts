const TZ = 'Asia/Jakarta';

type Fields = Partial<Record<Intl.DateTimeFormatPartTypes, string>>;

/** Run a formatter and return its parts keyed by type. */
function parts(fmt: Intl.DateTimeFormat, date: Date): Fields {
  const out: Fields = {};
  for (const p of fmt.formatToParts(date)) out[p.type] = p.value;
  return out;
}

function asDate(value: Date | string): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric',
});

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
});

export function toJakartaDate(date: Date): string {
  const p = parts(dateTimeFmt, date);
  return `${p.year}-${p.month}-${p.day}`;
}

export function toJakartaMonth(date: Date): string {
  const p = parts(dateTimeFmt, date);
  return `${p.year}-${p.month}`;
}

export function toDate(value: Date | string | undefined | null): Date | null {
  if (!value) return null;
  const d = asDate(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Format date and time (DD/MM/YYYY HH:mm) in Asia/Jakarta */
export function formatDateTime(date: Date | string): string {
  const p = parts(dateTimeFmt, asDate(date));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** Format time only (HH:mm) in Asia/Jakarta */
export function formatTime(date: Date | string): string {
  return timeFmt.format(asDate(date));
}

/** Format date only (DD/MM/YYYY) in Asia/Jakarta */
export function formatDate(date: Date | string): string {
  return dateFmt.format(asDate(date));
}

/** Check if two dates are on the same day in Asia/Jakarta */
export function isSameDay(date1: Date, date2: Date): boolean {
  return toJakartaDate(date1) === toJakartaDate(date2);
}

const shortDateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, day: '2-digit', month: '2-digit',
});

const dayNameFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ, weekday: 'short',
});

const monthYearFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ, month: 'long', year: 'numeric',
});

const dateIdFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric',
});

const dateIdShortFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ, day: 'numeric', month: 'short',
});

/** Format a date string (YYYY-MM-DD) as "dd/MM" in Jakarta */
export function formatShortDate(dateStr: string): string {
  const p = parts(shortDateFmt, new Date(dateStr + 'T00:00:00+07:00'));
  return `${p.day}/${p.month}`;
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
  return dateIdFmt.format(asDate(date));
}

/** "2 Jun" in Jakarta (no year) */
export function formatDateIdShort(date: Date | string): string {
  return dateIdShortFmt.format(asDate(date));
}

/** Get Jakarta year and month (0-based) from now */
export function jakartaNow(): { year: number; month: number } {
  const p = parts(dateTimeFmt, new Date());
  return {
    year: parseInt(p.year!, 10),
    month: parseInt(p.month!, 10) - 1,
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
