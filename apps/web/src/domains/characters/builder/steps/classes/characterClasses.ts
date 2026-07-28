export function toClassLevel(value: number | string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1

  return Math.min(20, Math.max(1, Math.trunc(value)))
}
