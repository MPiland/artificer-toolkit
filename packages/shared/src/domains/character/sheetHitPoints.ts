function requireInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${label} must be an integer.`)
  }
}

export function resolveCharacterEffectiveMaximumHitPoints(maximumHitPoints: number): number {
  requireInteger(maximumHitPoints, 'Maximum hit points')
  return Math.max(0, maximumHitPoints)
}

export function clampCharacterCurrentHitPoints(
  currentHitPoints: number,
  maximumHitPoints: number
): number {
  requireInteger(currentHitPoints, 'Current hit points')
  return Math.min(
    Math.max(0, currentHitPoints),
    resolveCharacterEffectiveMaximumHitPoints(maximumHitPoints)
  )
}
