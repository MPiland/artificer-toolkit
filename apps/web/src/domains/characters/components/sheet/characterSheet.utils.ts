export function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : String(value)
}

export function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value || 0)
}

export function compactText(value: string | undefined): string {
  return value && value.trim().length > 0 ? value : 'Not set'
}
