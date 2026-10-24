import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { CompiledSpell } from '@artificer-toolkit/shared/subjects/compilers'

import {
  effectReadsSpellCastLevel,
  normalizeCharacterActionMechanicFacts
} from './characterActionRuleFacts.js'

export function buildCharacterSpellActionRuleFacts(params: {
  spellIds: readonly string[]
  spells: readonly CompiledSpell[]
}): Pick<CharacterRulePolicyInput, 'spellActionFacts'> {
  const spellsById = new Map(params.spells.map((spell) => [spell.id, spell]))
  const spellIds = [...new Set(params.spellIds)]

  return {
    spellActionFacts: spellIds.map((spellId) => {
      const spell = spellsById.get(spellId)
      if (!spell) {
        throw new Error(`Character spell action facts are missing spell "${spellId}".`)
      }
      const effects = (spell.effects ?? []).filter((effect) => effect.invocation.kind !== 'PASSIVE')
      // The sibling Effects the cast's repeat offers name, which the compiled spell keeps only there.
      const repeated = new Map(
        effects.flatMap((effect) =>
          effect.entries.flatMap((entry) =>
            'outcome' in entry
              ? (entry.lifecycle?.effectOffers ?? []).flatMap((offer) =>
                  offer.kind === 'REPEAT_SOURCE_PATH' && offer.effect.id !== effect.id
                    ? [[offer.effect.id, offer.effect] as const]
                    : []
                )
              : []
          )
        )
      )
      return {
        spellId,
        readsCastLevel: effects.some(effectReadsSpellCastLevel),
        effects: effects.map((effect) => ({
          effectId: effect.id,
          mechanicFacts: normalizeCharacterActionMechanicFacts(effect)
        })),
        ...(repeated.size > 0 && {
          repeatedEffects: [...repeated.values()].map((effect) => ({
            effectId: effect.id,
            mechanicFacts: normalizeCharacterActionMechanicFacts(compileEffect(effect))
          }))
        })
      }
    })
  }
}
