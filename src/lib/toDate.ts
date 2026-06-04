export function toDate(value: Date | string | undefined | null): Date | null {
  if (!value) return null;
  const d = typeof value === 'string' ? new Date(value) : value;
  return isNaN(d.getTime()) ? null : d;
}
