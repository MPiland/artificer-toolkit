import type { SpellCastCapabilityAdapter } from '../../spellCastCandidates.js'
import { conditionDurationTurns } from './effectActionFollowUp.js'
import { DND5E_SYSTEM_ID } from './identity.js'
import { dnd5eSpellRangeReplacement } from './spellRangeReplacement.js'
import { dnd5eWithSaveSuccessDamage } from './spellSaveSuccessDamage.js'

/** A grant can replace a cast's range kind and add a success path to its failed-save damage. */
export const dnd5eSpellCastCapabilityAdapter: SpellCastCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  adaptCastEffect(grantFold, spell, effect) {
    const range = dnd5eSpellRangeReplacement(grantFold, spell)
    return dnd5eWithSaveSuccessDamage(
      grantFold,
      spell,
      range
        ? {
            ...effect,
            invocation: {
              ...effect.invocation,
              range: { id: effect.invocation.range.id, ...range }
            }
          }
        : effect
    )
  },
  durationTurns: conditionDurationTurns
}
