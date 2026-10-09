import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import { antitoxinVial } from '@artificer-toolkit/source-data/srd/equipment/antitoxin-vial.js'
import { unicorn } from '@artificer-toolkit/source-data/srd/creatures/unicorn.js'

import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { ENCOUNTER_ID } from '../testing/dnd5eSrdEncounter.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'

/** The grant effect the real compiler plans for one authored Effect, held by the actor. */
export function plannedGrantEffect(input: {
  id: string
  holderActorId: string
  effect: EffectAuthored | undefined
  sourceLabel: string
}) {
  if (!input.effect) throw new Error(`${input.sourceLabel} has no effect.`)
  const action = characterActionDescriptor(compileEffect({ ...input.effect, id: ACTION_EFFECT_ID }))
  const published = dnd5eCharacterRuleActionSystemAdapter.compile({ action })
  const [plan] =
    dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({ action, published }) ?? []
  if (!plan?.modifierGrantContribution) throw new Error(`${input.sourceLabel} plans no grant.`)
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
        sourceLabel: input.sourceLabel,
        sourceHidden: false
      }
    ]
  })
}

/** The active effect the real compiler plans for drinking the SRD Antitoxin, held by the actor. */
export function antitoxinEffect(input: { id: string; holderActorId: string }) {
  return plannedGrantEffect({
    ...input,
    effect: antitoxinVial.effects?.[0],
    sourceLabel: antitoxinVial.label
  })
}

/** The active effect the real compiler plans for the SRD unicorn's Shimmering Shield (+2 AC). */
export function shimmeringShieldEffect(input: { id: string; holderActorId: string }) {
  const option = unicorn.features
    ?.flatMap((feature) => feature.options ?? [])
    .find((entry) => entry.label.startsWith('Shimmering Shield'))
  return plannedGrantEffect({
    ...input,
    effect: option?.effects?.[0],
    sourceLabel: option?.label ?? 'Shimmering Shield'
  })
}
