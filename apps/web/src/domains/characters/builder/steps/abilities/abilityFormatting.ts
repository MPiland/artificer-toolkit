export function formatPointDelta(delta: number): string {
  if (delta === 0) return '±0'

  return delta > 0 ? `+${delta}` : `${delta}`
}

export function formatSignedNumber(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}
