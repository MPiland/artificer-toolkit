import { v5 as uuidv5 } from 'uuid'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'

import type { CharacterRulePolicyFactsResult } from './character/characterRulePolicyFacts.js'
import { getRestRecoveryTriggers } from './character/sheetRest.js'
import {
  discoverCharacterActionCapabilities,
  type EffectActionCapabilityDescriptor
} from './characterActionCapabilityDiscovery.js'
import {
  CharacterRuleActionUnsupportedCompilationError,
  type CharacterRuleActionSystemAdapter
} from './characterRuleActionSystemAdapter.js'
import { prepareRecurringActiveEffect, type EffectPlan } from './encounterActionEffectPlans.js'
import { characterRuleActionSystemAdapterRegistry } from './platformEncounterPolicy.js'
import {
  holdsStandingEffect,
  standingEffectReturnsOn,
  type StandingEffect
} from './standingEffects.js'

// Compiling and arming standing effects reaches the Encounter rules, so it stays out of
// `standingEffects.ts`, which the browser's Builder reads (ADR 0036 S6).

const STANDING_EFFECT_NAMESPACE = 'e3b6f0d2-5a4c-4c1e-8f27-91d0a6b5c834'

/** The standing effect of one passive capability; one its System cannot hold throws the unsupported-compilation error. */
export function compileStandingEffect(
  adapter: CharacterRuleActionSystemAdapter,
  capability: EffectActionCapabilityDescriptor,
  label: string
): StandingEffect {
  const returnsOn = standingEffectReturnsOn(capability.compiledEffect)
  const plan = adapter.standingEffectPlan?.({ action: capability })
  if (!returnsOn || !plan)
    throw new CharacterRuleActionUnsupportedCompilationError(
      'A standing effect gives one untimed grant that a rest turns back on.'
    )
  return { effectId: capability.effectId, label, returnsOn, plan }
}

/** The standing effects of a Character's passive features; one its System cannot hold is not held. */
export function characterStandingEffects(input: {
  sources: CharacterRulePolicyFactsResult['standingEffectSources']
  gameSystemId: string
  conditionDefinitionIds: readonly string[]
  abilityDefinitions: readonly { id: string; code: string }[]
}): StandingEffect[] {
  const { candidates, entryPoints } = input.sources
  if (!candidates.length) return []
  const adapter = characterRuleActionSystemAdapterRegistry.require(input.gameSystemId)
  return discoverCharacterActionCapabilities({
    gameSystemId: input.gameSystemId,
    candidates,
    conditionDefinitionIds: input.conditionDefinitionIds,
    abilityDefinitions: input.abilityDefinitions,
    entryPoints
  }).flatMap((capability) => {
    try {
      const candidate = candidates.find(({ actionId }) => actionId === capability.actionId)
      if (!candidate) throw new Error('A standing effect capability has no candidate.')
      return [compileStandingEffect(adapter, capability, candidate.label)]
    } catch (error) {
      if (error instanceof CharacterRuleActionUnsupportedCompilationError) return []
      throw error
    }
  })
}

/**
 * The effects a finished rest turns back on for one holder: each of its ended standing effects that
 * returns on this rest, made as the effect it holds. The ids are fixed by the rest command, the
 * holder and the feature Effect, so a replayed rest makes the same effects.
 */
export function prepareRestStandingEffects(input: {
  standing: readonly StandingEffect[]
  restKind: 'SHORT' | 'LONG'
  holder: {
    actorId: string
    conditionIds: readonly string[]
    effectiveSize: string | null
    /** A Character's effect outlasts any Run; a Creature's lasts while its Encounter does. */
    lifetimeScope: 'OWNER' | 'ENCOUNTER'
    hidden: boolean
    held: readonly ActiveRuleEffectRecord[]
  }
  origin:
    | { characterId: string; occurrenceId: string; commandId: string }
    | {
        encounterId: string
        currentActorId: string | null
        occurrenceId: string
        commandId: string
      }
}): (EffectPlan & { id: string })[] {
  const { holder, origin } = input
  const restTriggers = getRestRecoveryTriggers(input.restKind)
  return input.standing
    .filter(
      (standing) =>
        restTriggers.has(standing.returnsOn) && !holdsStandingEffect(standing, holder.held)
    )
    .map((standing) => {
      const effect = prepareRecurringActiveEffect({
        ...('characterId' in origin
          ? { characterOrigin: origin, currentActorId: null }
          : {
              encounterId: origin.encounterId,
              occurrenceId: origin.occurrenceId,
              commandId: origin.commandId,
              currentActorId: origin.currentActorId
            }),
        // A holder is the source of its own standing effect.
        sourceActorId: holder.actorId,
        sourceLabel: standing.label,
        sourceHidden: holder.hidden,
        target: {
          actorId: holder.actorId,
          conditionIds: holder.conditionIds,
          effectiveSize: holder.effectiveSize,
          lifetimeScope: holder.lifetimeScope,
          activeEffects: holder.held
        },
        activeEffectsByActorId: new Map([[holder.actorId, holder.held]]),
        activeEffectPlan: standing.plan,
        published: standing.plan.frozenGraph,
        d20: null
      })
      if (!effect) throw new Error('A standing effect yields no effect.')
      return {
        id: uuidv5(
          `${origin.commandId}:${holder.actorId}:${standing.effectId}`,
          STANDING_EFFECT_NAMESPACE
        ),
        ...effect
      }
    })
}
