import { ABILITIES } from '@artificer-toolkit/shared/core'
import { resolveSystemSkillAbilities, SKILL_ABILITY_MAP } from '@artificer-toolkit/shared/character'
import type { CharacterAssemblyRegistry } from '@artificer-toolkit/shared/core'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

export const DND5E_2014_EXHAUSTION_PRESENTATION = {
  label: 'Exhaustion',
  description:
    '<p>Each exhaustion level includes the effects of every lower level.</p><ol><li><strong>Level 1:</strong> Disadvantage on ability checks.</li><li><strong>Level 2:</strong> Speed is halved.</li><li><strong>Level 3:</strong> Disadvantage on attack rolls and saving throws.</li><li><strong>Level 4:</strong> Hit point maximum is halved.</li><li><strong>Level 5:</strong> Speed is reduced to 0.</li><li><strong>Level 6:</strong> Death.</li></ol>'
} as const

const ABILITY_CANONICAL_BY_ALIAS = (() => {
  const aliases = new Map<string, string>()
  for (const abilityCode of Object.keys(ABILITIES)) {
    aliases.set(abilityCode, abilityCode)
    const short = ABILITIES[abilityCode as keyof typeof ABILITIES].short
    if (short) aliases.set(short, abilityCode)
  }
  return aliases
})()

export const CHARACTER_ABILITY_ALIASES: Readonly<Record<string, string>> = {
  STRENGTH: 'STR',
  DEXTERITY: 'DEX',
  CONSTITUTION: 'CON',
  INTELLIGENCE: 'INT',
  WISDOM: 'WIS',
  CHARISMA: 'CHA'
}

export function isAbilityCode(value: string): value is keyof typeof ABILITIES {
  return value in ABILITIES
}

function resolveAbilityCode(subjectId: string): keyof typeof ABILITIES | undefined {
  const direct = ABILITY_CANONICAL_BY_ALIAS.get(subjectId)
  if (direct && isAbilityCode(direct)) return direct

  const upper = ABILITY_CANONICAL_BY_ALIAS.get(subjectId.toUpperCase())
  return upper && isAbilityCode(upper) ? upper : undefined
}

function toSkillCanonicalCode(value: string | undefined): string {
  if (!value) return ''
  return value.toLowerCase().trim().replace(/_/g, '-').replace(/\s+/g, '-')
}

function toSkillFallbackCode(slug: string): string {
  return slug.toUpperCase().replace(/-/g, '_')
}

function toSkillFallbackLabel(slug: string): string {
  return slug
    .split('-')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

export function createSkillReference(system: CharacterAssemblyRegistry['system']) {
  const canonicalBySubject = new Map<string, string>()
  const metadataByCanonical = new Map<
    string,
    {
      skillId: string
      code: string
      label: string
      ability: keyof typeof ABILITIES
    }
  >()

  if (system?.schemaVersion === 4) {
    for (const { skill, code, canonicalId, abilityCode } of resolveSystemSkillAbilities(system)) {
      const ability = resolveAbilityCode(abilityCode)
      if (!ability) {
        throw new Error(
          `System check definition "${skill.id}" is governed by an ability the Sheet does not know.`
        )
      }
      metadataByCanonical.set(canonicalId, {
        skillId: skill.id,
        code,
        label: skill.label,
        ability
      })
      for (const alias of [skill.id, code, code.toUpperCase(), canonicalId])
        canonicalBySubject.set(alias, canonicalId)
    }
    return { canonicalBySubject, metadataByCanonical }
  }

  for (const [skillId, ability] of Object.entries(SKILL_ABILITY_MAP)) {
    const abilityCode = resolveAbilityCode(ability)
    if (!abilityCode) continue
    metadataByCanonical.set(skillId, {
      skillId,
      code: toSkillFallbackCode(skillId),
      label: toSkillFallbackLabel(skillId),
      ability: abilityCode
    })
    canonicalBySubject.set(skillId, skillId)
    canonicalBySubject.set(skillId.toUpperCase(), skillId)
  }

  for (const skill of system?.skills ?? []) {
    const canonicalFromCode = SKILL_ABILITY_MAP[toSkillCanonicalCode(skill.code)]
      ? toSkillCanonicalCode(skill.code)
      : undefined
    const canonicalFromId = SKILL_ABILITY_MAP[toSkillCanonicalCode(skill.id)]
      ? toSkillCanonicalCode(skill.id)
      : undefined
    const canonical = canonicalFromCode ?? canonicalFromId
    if (!canonical) continue

    canonicalBySubject.set(skill.id, canonical)
    if (skill.code) canonicalBySubject.set(skill.code, canonical)
    if (skill.code) canonicalBySubject.set(skill.code.toUpperCase(), canonical)
    if (skill.code) canonicalBySubject.set(toSkillCanonicalCode(skill.code), canonical)

    const existing = metadataByCanonical.get(canonical)
    if (existing) {
      metadataByCanonical.set(canonical, {
        ...existing,
        skillId: skill.id,
        code: skill.code ?? existing.code,
        label: skill.label
      })
    }
  }

  return { canonicalBySubject, metadataByCanonical }
}

export function resolveCharacterSheetSkillKey(
  system: CharacterAssemblyRegistry['system'],
  skillId: string
): string {
  return createSkillReference(system).canonicalBySubject.get(skillId) ?? skillId
}

export function getAbilityDerivedTotal(
  values: Readonly<Record<string, number>>,
  ability: keyof typeof ABILITIES
): number {
  const alias = CHARACTER_ABILITY_ALIASES[ability]
  return values[ability] ?? (alias ? values[alias] : undefined) ?? 0
}

type ClassSpellSelectionSource = {
  sourceKind: 'CLASS' | 'SUBCLASS'
  sourceRecordId: string
}

export function classSpellSelectionKey(classId: string, spellId: string): string {
  return `${classId}:${spellId}`
}

export function getClassSpellSelectionSources(
  character: CharacterAuthored
): ReadonlyMap<string, ClassSpellSelectionSource> {
  const sources = new Map<string, ClassSpellSelectionSource>()

  for (const selection of character.intent.spellSelections ?? []) {
    if (selection.source.kind !== 'CLASS' && selection.source.kind !== 'SUBCLASS') continue
    const source = selection.source
    const classId =
      source.kind === 'CLASS'
        ? source.classId
        : character.intent.classes.find((entry) => entry.subclassId === source.subclassId)?.classId
    if (!classId) continue

    for (const spellId of selection.spells) {
      const key = classSpellSelectionKey(classId, spellId)
      if (sources.has(key)) continue
      sources.set(key, {
        sourceKind: source.kind,
        sourceRecordId: selection.id
      })
    }
  }

  return sources
}
