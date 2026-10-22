import {
  createCharacterSpellSourceKey,
  type CharacterResourceOwnerRef
} from '@artificer-toolkit/shared/character'
import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'

export type CharacterSheetSpellSource = {
  id?: string
  classId?: string
  label: string
  source: {
    spellId: string
    sourceKind:
      | 'BACKGROUND'
      | 'CLASS'
      | 'FEAT'
      | 'FEATURE'
      | 'ITEM'
      | 'OPTION'
      | 'RACE'
      | 'SUBCLASS'
    sourceInstanceId: string
  }
  canPrepare: boolean
  prepared: boolean
  provenance?:
    | 'CLASS'
    | 'SUBCLASS'
    | 'RACE'
    | 'BACKGROUND'
    | 'FEAT'
    | 'FEATURE'
    | 'OPTION'
    | 'EQUIPMENT'
  acquisition?: 'KNOWN' | 'PREPARED' | 'ALWAYS_PREPARED' | 'GRANTED'
  castMode?: 'SPELL_SLOT' | 'AT_WILL' | 'RITUAL' | 'FIXED_LEVEL' | 'LIMITED_USE'
  fixedLevel?: number
  resourceGrantId?: string
  resourceOwner?: CharacterResourceOwnerRef
}

/** A Class's ritual casting is its own source, apart from its slot casting of the same spell (D171). */
export function addClassRitualSources(
  sourcesBySpellId: Map<string, Map<string, CharacterSheetSpellSource>>,
  classRitualSources: NonNullable<CharacterBuildSnapshot['classRitualSources']>,
  classLabels: ReadonlyMap<string, string>
): void {
  for (const { classId, source } of classRitualSources) {
    const sources =
      sourcesBySpellId.get(source.spellId) ?? new Map<string, CharacterSheetSpellSource>()
    sources.set(createCharacterSpellSourceKey(source), {
      id: source.sourceInstanceId,
      classId,
      label: `${classLabels.get(classId) ?? 'Class'} (ritual)`,
      source,
      provenance: 'CLASS',
      acquisition: 'GRANTED',
      castMode: 'RITUAL',
      canPrepare: false,
      prepared: true
    })
    sourcesBySpellId.set(source.spellId, sources)
  }
}
