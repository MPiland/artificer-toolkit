import { ABILITIES } from '../core/ability.js'
import type { CharacterAssemblyRegistry } from './ruleRegistry.js'

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

export const SKILL_ABILITY_MAP: Record<string, string> = {
  acrobatics: 'DEX',
  'animal-handling': 'WIS',
  arcana: 'INT',
  athletics: 'STR',
  deception: 'CHA',
  history: 'INT',
  insight: 'WIS',
  intimidation: 'CHA',
  investigation: 'INT',
  medicine: 'WIS',
  nature: 'INT',
  perception: 'WIS',
  performance: 'CHA',
  persuasion: 'CHA',
  religion: 'INT',
  'sleight-of-hand': 'DEX',
  stealth: 'DEX',
  survival: 'WIS'
}

export type ParsedModifierDomainKey = {
  valueDomainCode: string
  modifierKind: string
  params: Record<string, string>
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

const ABILITY_CANONICAL_BY_ALIAS = (() => {
  const aliases = new Map<string, string>()
  for (const abilityCode of Object.keys(ABILITIES)) {
    aliases.set(abilityCode, abilityCode)
    const short = ABILITIES[abilityCode as keyof typeof ABILITIES].short
    if (short) aliases.set(short, abilityCode)
  }
  return aliases
})()

export function resolveAbilityAlias(subjectId: string): string | undefined {
  return (
    ABILITY_CANONICAL_BY_ALIAS.get(subjectId) ??
    ABILITY_CANONICAL_BY_ALIAS.get(subjectId.toUpperCase())
  )
}

function toSkillCanonicalId(value: string): string {
  return value.toLowerCase().trim().replace(/_/g, '-').replace(/\s+/g, '-')
}

export function resolveSkillAlias(subjectId: string, skillAliases: Map<string, string>): string {
  if (skillAliases.has(subjectId)) return skillAliases.get(subjectId) ?? subjectId
  const lower = subjectId.toLowerCase()
  if (skillAliases.has(lower)) return skillAliases.get(lower) ?? subjectId

  const normalized = toSkillCanonicalId(subjectId)
  if (skillAliases.has(normalized)) return skillAliases.get(normalized) ?? subjectId
  if (skillAliases.has(normalized.toUpperCase())) {
    return skillAliases.get(normalized.toUpperCase()) ?? subjectId
  }

  return subjectId
}

export function buildSkillSubjectAliasMap(
  registry: CharacterAssemblyRegistry
): Map<string, string> {
  const aliases = new Map<string, string>()

  for (const canonical of Object.keys(SKILL_ABILITY_MAP)) {
    aliases.set(canonical, canonical)
    aliases.set(canonical.toUpperCase(), canonical)
  }

  for (const skill of registry.system?.skills ?? []) {
    const canonicalByCode = toSkillCanonicalId(skill.code ?? '')
    const canonical =
      SKILL_ABILITY_MAP[canonicalByCode] !== undefined
        ? canonicalByCode
        : SKILL_ABILITY_MAP[toSkillCanonicalId(skill.id)] !== undefined
          ? toSkillCanonicalId(skill.id)
          : undefined

    if (!canonical) continue

    aliases.set(skill.id, canonical)
    if (skill.code) {
      aliases.set(skill.code, canonical)
      aliases.set(skill.code.toUpperCase(), canonical)
      aliases.set(canonicalByCode, canonical)
    }
  }

  return aliases
}

export function buildModifierDomainKey(
  valueDomainCode: string,
  modifierKind: string,
  domain?: Record<string, unknown>
): string {
  const entries = Object.entries(domain ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))

  if (entries.length === 0) return `${valueDomainCode}:${modifierKind}`

  const paramKey = entries.map(([key, value]) => `${key}=${String(value)}`).join('|')
  return `${valueDomainCode}:${modifierKind}|${paramKey}`
}

export function parseModifierDomainKey(domainKey: string): ParsedModifierDomainKey {
  const [head, ...paramParts] = domainKey.split('|')
  const [valueDomainCode = 'UNKNOWN', modifierKind = 'BONUS'] = head.split(':')
  const params = Object.fromEntries(
    paramParts
      .map((part) => {
        const separator = part.indexOf('=')
        if (separator < 0) return null
        return [part.slice(0, separator), part.slice(separator + 1)]
      })
      .filter((entry): entry is [string, string] => entry !== null)
  )

  return { valueDomainCode, modifierKind, params }
}
