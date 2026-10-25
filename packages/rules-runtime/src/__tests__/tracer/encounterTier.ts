import {
  encounterActorRuleInputSchema,
  encounterActorRuleOutputSchema,
  type EncounterActorRuleOutput
} from '@artificer-toolkit/schema/api/encounterActorRules'

import type { InitiativeFactAdapter } from '../../initiativeFactAdapter.js'
import type { GameSystemEncounterTier } from '../../platformEncounterPolicy.js'
import { TRACER_SYSTEM_ID } from './system.js'

export const TRACER_INITIATIVE_FACT_KEYS = {
  rating: 'tracer.initiative.rating',
  orderChoiceMinimumIndex: 'tracer.initiative.choice-min-index',
  orderChoiceMaximumIndex: 'tracer.initiative.choice-max-index'
} as const

/** An approach rating is its own bonus: no score-to-modifier table, no saving throws. */
function evaluateTracerEncounterActors(candidate: unknown): EncounterActorRuleOutput {
  const input = encounterActorRuleInputSchema.parse(candidate)
  return encounterActorRuleOutputSchema.parse({
    actors: input.actors.map((actor) => ({
      actorId: actor.actorId,
      initiativeModifier: actor.initiativeAbilityDefinitionId
        ? (actor.abilityScores[actor.initiativeAbilityDefinitionId] ?? 0)
        : 0,
      targetProtection: actor.targetProtection,
      featureResources: actor.featureResources.map((feature) => ({
        featureId: feature.featureId,
        maximum: null,
        reconciliationPolicy: null,
        rawUsed: feature.used,
        used: 0,
        remaining: null,
        resetKind: null
      }))
    }))
  })
}

/** Creatures roll by their initiative approach; Characters and custom actors are entered by hand. */
const tracerInitiativeAdapter: InitiativeFactAdapter = {
  gameSystemId: TRACER_SYSTEM_ID,
  bindActor: (source) =>
    source.kind === 'CREATURE'
      ? {
          automatic: true,
          facts: { [TRACER_INITIATIVE_FACT_KEYS.rating]: source.actorRule.initiativeModifier }
        }
      : { automatic: false },
  bindDeclaredActor: () => ({ automatic: false }),
  bindSide: () => ({ automatic: true, facts: { [TRACER_INITIATIVE_FACT_KEYS.rating]: 0 } }),
  declaredRollMode: () => null
}

/** The tracer's Encounter tier: actor evaluation and initiative, nothing D&D-shaped. */
export const tracerEncounterTier: GameSystemEncounterTier = {
  gameSystemId: TRACER_SYSTEM_ID,
  evaluateEncounterActors: evaluateTracerEncounterActors,
  initiative: tracerInitiativeAdapter
}
