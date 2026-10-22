import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'

type SpellMechanicsFacts = CharacterRulePolicyInput['spellMechanicsFacts']
type SpellSource = SpellMechanicsFacts['snapshotSources'][number]

function source(spellSource: Omit<SpellSource, 'sequence'>, sequence: number): SpellSource {
  return { ...spellSource, sequence }
}

export function buildCharacterSpellMechanicsRuleFacts(
  snapshot: CharacterBuildSnapshot
): Pick<CharacterRulePolicyInput, 'spellMechanicsFacts'> {
  return {
    spellMechanicsFacts: {
      snapshotSources: [
        ...(snapshot.spellSources ?? []),
        ...(snapshot.classRitualSources ?? []).map(({ source }) => source)
      ].map((spellSource, sequence) => source(spellSource, sequence)),
      adjustments: (snapshot.adjustments ?? [])
        .filter(
          (
            adjustment
          ): adjustment is Extract<typeof adjustment, { family: 'SPELL'; value: number }> =>
            adjustment.family === 'SPELL' && typeof adjustment.value === 'number'
        )
        .map((adjustment, sequence) => ({
          sequence,
          id: adjustment.id,
          source: adjustment.source,
          field: adjustment.field,
          value: adjustment.value
        }))
    }
  }
}
