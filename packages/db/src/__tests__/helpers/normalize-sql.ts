export function normalizeSql(source: string): string {
  return source.replace(/\s+/gu, ' ').replace(/\(\s+/gu, '(').replace(/\s+\)/gu, ')').trim()
}
