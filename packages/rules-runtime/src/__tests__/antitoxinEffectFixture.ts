import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { EffectAuthored, PathLifecycleAuthored } from '@artificer-toolkit/shared/authored'
import { antitoxinVial } from '@artificer-toolkit/source-data/srd/equipment/antitoxin-vial.js'
import { unicorn } from '@artificer-toolkit/source-data/srd/creatures/unicorn.js'
import { darkvision } from '@artificer-toolkit/source-data/srd/spells/darkvision.js'
import { heroism } from '@artificer-toolkit/source-data/srd/spells/heroism.js'
import { longstrider } from '@artificer-toolkit/source-data/srd/spells/longstrider.js'
import { protectionFromEnergy } from '@artificer-toolkit/source-data/srd/spells/protection-from-energy.js'
import { viciousMockery } from '@artificer-toolkit/source-data/srd/spells/vicious-mockery.js'

import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { ENCOUNTER_ID } from '../testing/dnd5eSrdEncounter.js'
import { aidAtSecondLevel, grantPublishedIdentity } from '../testing/modifierGrantFixture.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'

/** The authored effect with its grant path(s) carrying the lifecycle, other paths dropped. */
export function grantOnly(
  effect: EffectAuthored,
  lifecycle: PathLifecycleAuthored
): EffectAuthored {
  return {
    ...effect,
    paths: effect.paths.flatMap((path) =>
      path.selectionKind === 'FIXED' &&
      path.resultBlock.outcomes.some((outcome) => outcome.effectKind === 'APPLY_GRANT')
        ? [
            {
              ...path,
              resultBlock: {
                ...path.resultBlock,
                lifecycle: { ...path.resultBlock.lifecycle, ...lifecycle }
              }
            }
          ]
        : []
    )
  }
}

/** The grant effect the real compiler plans for one authored Effect, held by the actor. */
export function plannedGrantEffect(input: {
  id: string
  holderActorId: string
  effect: EffectAuthored | undefined
  sourceLabel: string
}) {
  if (!input.effect) throw new Error(`${input.sourceLabel} has no effect.`)
  const action = characterActionDescriptor(compileEffect({ ...input.effect, id: ACTION_EFFECT_ID }))
  const published = grantPublishedIdentity()
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
        senses: [...plan.modifierGrantContribution.senses],
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

/** The active effect the real compiler plans for the SRD Darkvision spell (a 60-foot sense). */
export function darkvisionEffect(input: { id: string; holderActorId: string }) {
  return plannedGrantEffect({
    ...input,
    effect: darkvision.effects?.[0],
    sourceLabel: darkvision.label
  })
}

/** The active effect the real compiler plans for the SRD Aid as cast at 2nd level (+5 maximum). */
export function aidEffect(input: { id: string; holderActorId: string }) {
  return plannedGrantEffect({ ...input, effect: aidAtSecondLevel(), sourceLabel: 'Aid' })
}

/** The active effect the real compiler plans for the SRD Longstrider (+10 feet of walking speed). */
export function longstriderEffect(input: { id: string; holderActorId: string }) {
  return plannedGrantEffect({
    ...input,
    effect: longstrider.effects?.[0],
    sourceLabel: longstrider.label
  })
}

/** The active effect the real compiler plans for the SRD Heroism (immunity to Frightened). */
export function heroismEffect(input: { id: string; holderActorId: string }) {
  return plannedGrantEffect({ ...input, effect: heroism.effects?.[0], sourceLabel: heroism.label })
}

/**
 * The active effect the real compiler plans for the SRD Vicious Mockery's disadvantage, its
 * "before the end of its next turn" anchor authored (the SRD record does not carry it yet).
 */
export function viciousMockeryEffect(input: { id: string; holderActorId: string }) {
  const effect = viciousMockery.effects?.[0]
  return plannedGrantEffect({
    ...input,
    effect:
      effect && grantOnly(effect, { turnAnchor: { actor: 'TARGET', boundary: 'END_OF_TURN' } }),
    sourceLabel: viciousMockery.label
  })
}

/** The active effect the real compiler plans for the SRD Protection from Energy, choosing one energy. */
export function protectionFromEnergyEffect(input: {
  id: string
  holderActorId: string
  energyLabel: string
}) {
  const effect = protectionFromEnergy.effects?.[0]
  const choice = effect?.paths[0]
  if (!effect || choice?.selectionKind !== 'CHOICE')
    throw new Error('Protection from Energy has no energy choice.')
  const option = choice.options.find(({ label }) => label === input.energyLabel)
  if (!option) throw new Error(`No ${input.energyLabel} option.`)
  const { options: _options, ...path } = choice
  return plannedGrantEffect({
    id: input.id,
    holderActorId: input.holderActorId,
    effect: {
      ...effect,
      paths: [{ ...path, selectionKind: 'FIXED', resultBlock: option.resultBlock }]
    },
    sourceLabel: protectionFromEnergy.label
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
