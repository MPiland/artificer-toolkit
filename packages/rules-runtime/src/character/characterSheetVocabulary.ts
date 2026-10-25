import {
  buildSkillSubjectAliasMap,
  resolveSystemSkillAbilities
} from '@artificer-toolkit/shared/character'
import type { CharacterAssemblyRegistry } from '@artificer-toolkit/shared/core'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { systemCoreCodeRegistry } from '../platformSystemCoreCodes.js'

export const DND5E_2014_EXHAUSTION_PRESENTATION = {
  label: 'Exhaustion',
  description:
    '<p>Each exhaustion level includes the effects of every lower level.</p><ol><li><strong>Level 1:</strong> Disadvantage on ability checks.</li><li><strong>Level 2:</strong> Speed is halved.</li><li><strong>Level 3:</strong> Disadvantage on attack rolls and saving throws.</li><li><strong>Level 4:</strong> Hit point maximum is halved.</li><li><strong>Level 5:</strong> Speed is reduced to 0.</li><li><strong>Level 6:</strong> Death.</li></ol>'
} as const

export function createSkillReference(
  system: CharacterAssemblyRegistry['system'],
  systemId: string
) {
  // One alias map with the rule facts, which refuses an alias two System skills share.
  const canonicalBySubject = buildSkillSubjectAliasMap(system)
  const metadataByCanonical = new Map<
    string,
    {
      skillId: string
      code: string
      label: string
      ability: string
    }
  >()

  if (!system) return { canonicalBySubject, metadataByCanonical }
  const abilityCodes = systemCoreCodeRegistry.abilityCodes(systemId)
  for (const { skill, code, canonicalId, abilityCode } of resolveSystemSkillAbilities(system)) {
    if (!abilityCodes.includes(abilityCode)) {
      throw new Error(
        `System check definition "${skill.id}" is governed by an ability the Game System does not define.`
      )
    }
    metadataByCanonical.set(canonicalId, {
      skillId: skill.id,
      code,
      label: skill.label,
      ability: abilityCode
    })
  }
  return { canonicalBySubject, metadataByCanonical }
}

export function resolveCharacterSheetSkillKey(
  system: CharacterAssemblyRegistry['system'],
  skillId: string
): string {
  return buildSkillSubjectAliasMap(system).get(skillId) ?? skillId
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
