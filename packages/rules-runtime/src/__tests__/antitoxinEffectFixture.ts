import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { antitoxinVial } from '@artificer-toolkit/source-data/srd/equipment/antitoxin-vial.js'

import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { ENCOUNTER_ID } from '../testing/dnd5eSrdEncounter.js'
import { ACTION_EFFECT_ID, characterActionDescriptor } from './characterActionDescriptor.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'

/** The active effect the real compiler plans for drinking the SRD Antitoxin, held by the actor. */
export function antitoxinEffect(input: { id: string; holderActorId: string }) {
  const [effect] = antitoxinVial.effects ?? []
  if (!effect) throw new Error('The SRD Antitoxin has no effect.')
  const action = characterActionDescriptor(compileEffect({ ...effect, id: ACTION_EFFECT_ID }))
  const published = dnd5eCharacterRuleActionSystemAdapter.compile({ action })
  const [plan] =
    dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({ action, published }) ?? []
  if (!plan?.modifierGrantContribution) throw new Error('The Antitoxin plans no grant.')
  return activeEffect({
    id: input.id,
    owner: {
      kind: 'ENCOUNTER_ACTOR',
      encounterId: ENCOUNTER_ID,
      targetActorId: input.holderActorId
    },
    createdOrdinal: 1,
    stateContributions: [
      {
        kind: 'MODIFIER_GRANT',
        applyGrantOutcomeId: plan.modifierGrantContribution.applyGrantOutcomeId,
        modifiers: [...plan.modifierGrantContribution.modifiers],
        sourceLabel: antitoxinVial.label,
        sourceHidden: false
      }
    ]
  })
}
