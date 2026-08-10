export type RuntimeTimestamp = Date | string
export function toIsoString(value: RuntimeTimestamp): string {
  const parsed = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Invalid database timestamp "${value}".`)
  return parsed.toISOString()
}
export function toOptionalIsoString(value: RuntimeTimestamp | null): string | null {
  return value === null ? null : toIsoString(value)
}
