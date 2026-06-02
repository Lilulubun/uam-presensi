const snakeToCamel = (s: string): string =>
  s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

export function toCamelCase<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    out[snakeToCamel(key)] = row[key];
  }
  return out as T;
}

export function toCamelCaseArray<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map(toCamelCase<T>);
}
