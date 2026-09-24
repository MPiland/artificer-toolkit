/** Legacy policy facts are bounded JSON; absent object fields remain absent. */
export function characterPolicyRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function characterPolicyNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Character policy requires a finite numeric fact.')
  }
  return value
}

export function canonicalCharacterAbility(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const aliases: Record<string, string> = {
    STR: 'STRENGTH',
    DEX: 'DEXTERITY',
    CON: 'CONSTITUTION',
    INT: 'INTELLIGENCE',
    WIS: 'WISDOM',
    CHA: 'CHARISMA'
  }
  return Object.hasOwn(aliases, value) ? aliases[value]! : value
}
