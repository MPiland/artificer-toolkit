import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
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
      return {
        spellId,
        readsCastLevel: effects.some(effectReadsSpellCastLevel),
        effects: effects.map((effect) => ({
          effectId: effect.id,
          mechanicFacts: normalizeCharacterActionMechanicFacts(effect)
        }))
      }
    })
  }
}
