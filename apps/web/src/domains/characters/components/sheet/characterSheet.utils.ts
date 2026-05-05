export function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : String(value)
}

export function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value || 0)
}
