import { createClassRitualSourceInstanceId } from '@artificer-toolkit/shared/character'
import {
  SPELL_ATTRIBUTE,
  SPELLCASTING_ATTRIBUTE,
  type CharacterAssemblyRegistry,
  type CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'

/**
 * The ritual spells each Class casts as rituals (D171): a Class whose spellcasting carries
 * RITUAL_CASTER casts the ritual spells of its spellbook when it keeps one, else those it has
 * prepared. Each is a source of its own, apart from the Class's slot casting of the same spell.
 */
export function assembleClassRitualSources(
  character: CharacterAuthored,
  registry: Pick<CharacterAssemblyRegistry, 'classes'>,
  spells: readonly Pick<SpellAuthored, 'id' | 'attributes'>[]
): NonNullable<CharacterBuildSnapshot['classRitualSources']> {
  const ritualSpellIds = new Set(
    spells.filter((spell) => spell.attributes?.includes(SPELL_ATTRIBUTE.RITUAL)).map(({ id }) => id)
  )
  return (character.state.classes ?? []).flatMap((classState) => {
    const attributes = registry.classes[classState.classId]?.spellcasting?.attributes
    if (!attributes?.includes(SPELLCASTING_ATTRIBUTE.RITUAL_CASTER)) return []
    const castable = attributes.includes(SPELLCASTING_ATTRIBUTE.USES_SPELLBOOK)
      ? classState.spells?.learned
      : classState.spells?.prepared
    return [...new Set(castable ?? [])]
      .filter((spellId) => ritualSpellIds.has(spellId))
      .map((spellId) => ({
        classId: classState.classId,
        source: {
          spellId,
          sourceKind: 'CLASS' as const,
          sourceInstanceId: createClassRitualSourceInstanceId(classState.classId)
        }
      }))
  })
}
