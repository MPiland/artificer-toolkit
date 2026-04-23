const ABILITY_KEY_ALIASES: Record<string, string> = {
  STRENGTH: 'STR',
  STR: 'STRENGTH',
  DEXTERITY: 'DEX',
  DEX: 'DEXTERITY',
  CONSTITUTION: 'CON',
  CON: 'CONSTITUTION',
  INTELLIGENCE: 'INT',
  INT: 'INTELLIGENCE',
  WISDOM: 'WIS',
  WIS: 'WISDOM',
  CHARISMA: 'CHA',
  CHA: 'CHARISMA',
  SPELLCASTING: 'SPELLCASTING'
}

export function normalizeAbilityKey(ability: string | undefined): string | undefined {
  if (!ability) return undefined
  return ABILITY_KEY_ALIASES[ability] ?? ability
}

export function resolveAbilityRecordKey(
  record: Record<string, unknown>,
  ability: string | undefined
): string | undefined {
  if (!ability) return undefined
  if (ability in record) return ability

  const normalized = normalizeAbilityKey(ability)
  if (normalized && normalized in record) return normalized

  return normalized ?? ability
}
