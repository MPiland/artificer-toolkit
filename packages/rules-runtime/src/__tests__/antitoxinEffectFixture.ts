import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { EffectAuthored, PathLifecycleAuthored } from '@artificer-toolkit/shared/authored'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { barbarian } from '@artificer-toolkit/source-data/srd/classes/barbarian.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { antitoxinVial } from '@artificer-toolkit/source-data/srd/equipment/antitoxin-vial.js'
import { bane } from '@artificer-toolkit/source-data/srd/spells/bane.js'
import { bless } from '@artificer-toolkit/source-data/srd/spells/bless.js'
import { copperDragonWyrmling } from '@artificer-toolkit/source-data/srd/creatures/copper-dragon-wyrmling.js'
import { goldDragonWyrmling } from '@artificer-toolkit/source-data/srd/creatures/gold-dragon-wyrmling.js'
import { unicorn } from '@artificer-toolkit/source-data/srd/creatures/unicorn.js'
import { darkvision } from '@artificer-toolkit/source-data/srd/spells/darkvision.js'
import { dispelEvilAndGood } from '@artificer-toolkit/source-data/srd/spells/dispel-evil-and-good.js'
import { heroism } from '@artificer-toolkit/source-data/srd/spells/heroism.js'
import { holyAura } from '@artificer-toolkit/source-data/srd/spells/holy-aura.js'
import { longstrider } from '@artificer-toolkit/source-data/srd/spells/longstrider.js'
import { passWithoutTrace } from '@artificer-toolkit/source-data/srd/spells/pass-without-trace.js'
import { protectionFromEnergy } from '@artificer-toolkit/source-data/srd/spells/protection-from-energy.js'
import { protectionFromEvilAndGood } from '@artificer-toolkit/source-data/srd/spells/protection-from-evil-and-good.js'
import { stoneskin } from '@artificer-toolkit/source-data/srd/spells/stoneskin.js'
import { viciousMockery } from '@artificer-toolkit/source-data/srd/spells/vicious-mockery.js'

import { castChoiceOptions } from '../encounterCastChoice.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { ENCOUNTER_ID } from '../testing/dnd5eSrdEncounter.js'
import {
  aidAtSecondLevel,
  grantPublishedIdentity,
  sourceSightSaveAuthoredEffect
} from '../testing/modifierGrantFixture.js'
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

/**
 * The grant effect the real compiler plans for one authored Effect, held by the actor: cast at
 * `spellCastLevel`, as the cast-choice option labelled `choiceLabel`, by `sourceActorId`.
 */
export function plannedGrantEffect(input: {
  id: string
  holderActorId: string
  effect: EffectAuthored | undefined
  sourceLabel: string
  spellCastLevel?: number
  choiceLabel?: string
  sourceActorId?: string
}) {
  if (!input.effect) throw new Error(`${input.sourceLabel} has no effect.`)
  const compiled = compileEffect({ ...input.effect, id: ACTION_EFFECT_ID })
  const picked =
    input.choiceLabel === undefined
      ? compiled
      : castChoiceOptions(compiled)?.find(({ label }) => label === input.choiceLabel)
          ?.compiledEffect
  if (!picked) throw new Error(`${input.sourceLabel} offers no "${input.choiceLabel}".`)
  const action = characterActionDescriptor(picked, input.spellCastLevel)
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
    sourceActorId: input.sourceActorId ?? null,
    consumeOnFirstEvents: plan.modifierGrantContribution.consumeOnFirstEvents,
    endOnEvents: plan.modifierGrantContribution.endOnEvents,
    endOnTriggers: plan.lifecycle?.endOnTriggers ?? [],
    endOnConditionIds: plan.modifierGrantContribution.endOnConditionIds,
    holderEnd: plan.modifierGrantContribution.holderEnd,
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

/** The active effect the real compiler plans for the SRD Bless spell, held by a blessed creature. */
export function blessEffect(input: { id: string; holderActorId: string }) {
  return plannedGrantEffect({ ...input, effect: bless.effects?.[0], sourceLabel: bless.label })
}

/** The active effect the real compiler plans for a failed save against the SRD Bane spell. */
export function baneEffect(input: { id: string; holderActorId: string }) {
  return plannedGrantEffect({ ...input, effect: bane.effects?.[0], sourceLabel: bane.label })
}

/** The active effect the real compiler plans for the SRD Dodge action, held by the dodging actor. */
export function dodgeEffect(input: { id: string; holderActorId: string }) {
  const dodge = SRD_BASIC_ACTION_DEFINITIONS.find(({ id }) => id === SRD_BASIC_ACTION_IDS.DODGE)
  return plannedGrantEffect({
    ...input,
    effect: dodge?.document.effects[0],
    sourceLabel: dodge?.label ?? 'Dodge'
  })
}

/** The active effect the real compiler plans for the SRD Help action, held by the helped actor. */
export function helpEffect(input: { id: string; holderActorId: string }) {
  const help = SRD_BASIC_ACTION_DEFINITIONS.find(({ id }) => id === SRD_BASIC_ACTION_IDS.HELP)
  return plannedGrantEffect({
    ...input,
    effect: help?.document.effects[0],
    sourceLabel: help?.label ?? 'Help'
  })
}

/** The active effect the real compiler plans for the SRD Disengage action, held by the mover. */
export function disengageEffect(input: { id: string; holderActorId: string }) {
  const disengage = SRD_BASIC_ACTION_DEFINITIONS.find(
    ({ id }) => id === SRD_BASIC_ACTION_IDS.DISENGAGE
  )
  return plannedGrantEffect({
    ...input,
    effect: disengage?.document.effects[0],
    sourceLabel: disengage?.label ?? 'Disengage'
  })
}

/** The active effect the real compiler plans for the SRD Barbarian's Rage, held by the Barbarian. */
export function rageEffect(input: { id: string; holderActorId: string }) {
  return plannedGrantEffect({
    ...input,
    effect: barbarian.features?.find(({ label }) => label === 'Rage')?.effects?.[0],
    sourceLabel: 'Rage'
  })
}

/** The active effect the real compiler plans for the SRD Fighter's Action Surge, held by the Fighter. */
export function actionSurgeEffect(input: { id: string; holderActorId: string }) {
  return plannedGrantEffect({
    ...input,
    effect: fighter.features?.find(({ label }) => label === 'Action Surge')?.effects?.[0],
    sourceLabel: 'Action Surge'
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

/**
 * The active effect the real compiler plans for a "speed multiplied by n/d" grant (Slowing Breath
 * halves it), the SRD Longstrider's grant path with its bonus made the fraction. With no speed
 * named it covers every speed.
 */
export function speedFractionEffect(input: {
  id: string
  holderActorId: string
  fraction: { numerator: number; denominator: number }
  speedId?: string
}) {
  const effect = longstrider.effects?.[0]
  if (!effect) throw new Error('The SRD Longstrider has no effect.')
  return plannedGrantEffect({
    id: input.id,
    holderActorId: input.holderActorId,
    effect: {
      ...effect,
      paths: effect.paths.map((path) =>
        'resultBlock' in path
          ? {
              ...path,
              resultBlock: {
                ...path.resultBlock,
                outcomes: path.resultBlock.outcomes.map((outcome) =>
                  outcome.effectKind === 'APPLY_GRANT'
                    ? {
                        ...outcome,
                        grants: {
                          ...outcome.grants,
                          modifiers: outcome.grants.modifiers?.map(
                            (modifier) =>
                              ({
                                ...modifier,
                                domain:
                                  input.speedId === undefined ? {} : { speedId: input.speedId },
                                modifierKind: 'MULTIPLY',
                                payload: input.fraction
                              }) as typeof modifier
                          )
                        }
                      }
                    : outcome
                )
              }
            }
          : path
      )
    },
    sourceLabel: 'Speed fraction'
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

/**
 * The active effect the real compiler plans for the grants a dragon wyrmling's breath leaves,
 * held for the next turn. The wyrmling's authored grants ride in Vicious Mockery's grant path so
 * the compiler plans them as a plain timed grant.
 */
function breathGrantEffect(input: {
  id: string
  holderActorId: string
  creature: typeof goldDragonWyrmling
  sourceLabel: string
}) {
  const grants = input.creature.features
    ?.flatMap((feature) => feature.effects ?? [])
    .flatMap((effect) => effect.paths)
    .flatMap((path) => ('resultBlock' in path ? path.resultBlock.outcomes : []))
    .flatMap((outcome) => (outcome.effectKind === 'APPLY_GRANT' ? [outcome.grants] : []))[0]
  const mockery = viciousMockery.effects?.[0]
  if (!grants || !mockery) throw new Error(`The ${input.sourceLabel} grants are not authored.`)
  return plannedGrantEffect({
    id: input.id,
    holderActorId: input.holderActorId,
    effect: grantOnly(
      {
        ...mockery,
        paths: mockery.paths.map((path) =>
          'resultBlock' in path
            ? {
                ...path,
                resultBlock: {
                  ...path.resultBlock,
                  outcomes: path.resultBlock.outcomes.map((outcome) =>
                    outcome.effectKind === 'APPLY_GRANT' ? { ...outcome, grants } : outcome
                  )
                }
              }
            : path
        )
      },
      { turnAnchor: { actor: 'TARGET', boundary: 'END_OF_TURN' }, consumeOnFirstEvents: [] }
    ),
    sourceLabel: input.sourceLabel
  })
}

/** The Gold Dragon Wyrmling's Weakening Breath grants (Strength checks, saves and attacks at disadvantage). */
export function goldWeakeningEffect(input: { id: string; holderActorId: string }) {
  return breathGrantEffect({
    ...input,
    creature: goldDragonWyrmling,
    sourceLabel: 'Weakening Breath'
  })
}

/** The Copper Dragon Wyrmling's Slowing Breath grants (no reactions, half speed, one attack, action or bonus action). */
export function copperSlowingEffect(input: { id: string; holderActorId: string }) {
  return breathGrantEffect({
    ...input,
    creature: copperDragonWyrmling,
    sourceLabel: 'Slowing Breath'
  })
}

/** The SRD Protection from Energy with one energy chosen: its choice path made a fixed path. */
export function protectionFromEnergyChoice(energyLabel: string): EffectAuthored {
  const effect = protectionFromEnergy.effects?.[0]
  const choice = effect?.paths[0]
  if (!effect || choice?.selectionKind !== 'CHOICE')
    throw new Error('Protection from Energy has no energy choice.')
  const option = choice.options.find(({ label }) => label === energyLabel)
  if (!option) throw new Error(`No ${energyLabel} option.`)
  const { options: _options, ...path } = choice
  return {
    ...effect,
    paths: [{ ...path, selectionKind: 'FIXED', resultBlock: option.resultBlock }]
  }
}

/** The active effect the real compiler plans for the SRD Protection from Energy, choosing one energy. */
export function protectionFromEnergyEffect(input: {
  id: string
  holderActorId: string
  energyLabel: string
}) {
  return plannedGrantEffect({
    id: input.id,
    holderActorId: input.holderActorId,
    effect: protectionFromEnergyChoice(input.energyLabel),
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

/** The active effect the real compiler plans for the SRD Pass without Trace, held by one chosen creature. */
export function passWithoutTraceEffect(input: { id: string; holderActorId: string }) {
  return plannedGrantEffect({
    ...input,
    effect: passWithoutTrace.effects?.[0],
    sourceLabel: passWithoutTrace.label
  })
}

/** The active effect the real compiler plans for a sight-gated Dexterity-save advantage grant. */
export function sourceSightSaveEffect(input: { id: string; holderActorId: string }) {
  return plannedGrantEffect({
    ...input,
    effect: sourceSightSaveAuthoredEffect(),
    sourceLabel: 'Sight-gated save'
  })
}

/** The active effect the real compiler plans for the SRD Protection from Evil and Good spell, held by the warded creature. */
export function protectionFromEvilAndGoodEffect(input: { id: string; holderActorId: string }) {
  return plannedGrantEffect({
    ...input,
    effect: protectionFromEvilAndGood.effects?.[0],
    sourceLabel: protectionFromEvilAndGood.label
  })
}

/** The active effect the real compiler plans for the SRD Holy Aura spell, held by a creature it affects. */
export function holyAuraEffect(input: { id: string; holderActorId: string }) {
  return plannedGrantEffect({
    ...input,
    effect: holyAura.effects?.[0],
    sourceLabel: holyAura.label
  })
}

/** The active effect the real compiler plans for the SRD Dispel Evil and Good spell, held by its caster. */
export function dispelEvilAndGoodEffect(input: { id: string; holderActorId: string }) {
  return plannedGrantEffect({
    ...input,
    effect: dispelEvilAndGood.effects?.[0],
    sourceLabel: dispelEvilAndGood.label
  })
}

/** The active effect the real compiler plans for the SRD Stoneskin spell, held by the warded creature. */
export function stoneskinEffect(input: { id: string; holderActorId: string }) {
  return plannedGrantEffect({
    ...input,
    effect: stoneskin.effects?.[0],
    sourceLabel: stoneskin.label
  })
}
