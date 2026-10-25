import {
  encounterActorRuleInputSchema,
  encounterActorRuleOutputSchema,
  type EncounterActorRuleOutput
} from '@artificer-toolkit/schema/api/encounterActorRules'
import type { D20AddedDieDto } from '@artificer-toolkit/schema/shared/d20AddedDice'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import { RULE_RUNTIME_GRAPH_FAMILY_KEY } from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import {
  addedDiceTotalEvidenceRuleOperation,
  checksumRuleDocument,
  type RuleGraphDefinition
} from '@artificer-toolkit/shared/rules'

import type { D20TestDefinitionCapabilityAdapter } from '../../d20TestDefinitionCapability.js'
import type { InitiativeFactAdapter } from '../../initiativeFactAdapter.js'
import type { ModifierScopeCapabilityAdapter } from '../../modifierScopeCapability.js'
import type { GameSystemEncounterTier } from '../../platformEncounterPolicy.js'
import { TRACER_SYSTEM_ID } from './system.js'

export const TRACER_INITIATIVE_FACT_KEYS = {
  rating: 'tracer.initiative.rating',
  orderChoiceMinimumIndex: 'tracer.initiative.choice-min-index',
  orderChoiceMaximumIndex: 'tracer.initiative.choice-max-index'
} as const

export const TRACER_ADDED_DICE_FACT_KEYS = {
  min: 'tracer.added-dice-min',
  max: 'tracer.added-dice-max',
  enabled: 'tracer.added-dice-enabled'
} as const

const TRACER_APPROACH_CHECK_GRAPH_DEFINITION_ID = '00000000-0000-4000-8000-0000000f0e01'

/** The tracer grants no added dice, so its added-dice node always settles at 0, unrequested. */
export function tracerAddedDiceFacts(dice: readonly D20AddedDieDto[]) {
  if (dice.length > 0) throw new Error('The tracer grants no added dice.')
  return {
    [TRACER_ADDED_DICE_FACT_KEYS.min]: 0,
    [TRACER_ADDED_DICE_FACT_KEYS.max]: 0,
    [TRACER_ADDED_DICE_FACT_KEYS.enabled]: false
  }
}

/** An approach check: the neutral d20 request, then the tracer's own added-dice node (ADR 0039). */
function tracerApproachCheckDefinition() {
  const definition: RuleGraphDefinition = {
    schemaVersion: 1,
    id: TRACER_APPROACH_CHECK_GRAPH_DEFINITION_ID,
    gameSystemId: TRACER_SYSTEM_ID,
    definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
    nodes: [
      {
        id: 'd20',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
      },
      {
        id: 'd20-added-dice',
        operation: {
          key: addedDiceTotalEvidenceRuleOperation.key,
          contractVersion: addedDiceTotalEvidenceRuleOperation.contractVersion
        },
        inputs: {
          min: { kind: 'FACT', factKey: TRACER_ADDED_DICE_FACT_KEYS.min },
          max: { kind: 'FACT', factKey: TRACER_ADDED_DICE_FACT_KEYS.max },
          enabled: { kind: 'FACT', factKey: TRACER_ADDED_DICE_FACT_KEYS.enabled }
        }
      }
    ],
    outputs: {
      rawDie: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
      addedTotal: { kind: 'NODE_OUTPUT', nodeId: 'd20-added-dice', port: 'value' }
    }
  }
  return serverPublishedRuleDefinitionDtoSchema.parse({
    id: definition.id,
    gameSystemId: definition.gameSystemId,
    definitionFamilyKey: definition.definitionFamilyKey,
    checksum: checksumRuleDocument(definition),
    definition
  })
}

/** Approach checks only: the tracer has no death saves. */
const tracerD20TestDefinitionAdapter: D20TestDefinitionCapabilityAdapter = {
  gameSystemId: TRACER_SYSTEM_ID,
  basicActionCheckDefinition: tracerApproachCheckDefinition,
  addedDiceFacts: tracerAddedDiceFacts
}

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

/** A tracer grant applies wherever its holder acts, unless it waits on a requirement. */
const tracerModifierScopeAdapter: ModifierScopeCapabilityAdapter = {
  gameSystemId: TRACER_SYSTEM_ID,
  appliesCharacterWide: (modifier) =>
    modifier.scope === 'GLOBAL' && modifier.deferredRequirements.length === 0,
  saveRequiresSourceSight: () => false
}

/** The tracer's Encounter tier: actors, initiative and approach checks, nothing D&D-shaped. */
export const tracerEncounterTier: GameSystemEncounterTier = {
  gameSystemId: TRACER_SYSTEM_ID,
  evaluateEncounterActors: evaluateTracerEncounterActors,
  d20TestDefinition: tracerD20TestDefinitionAdapter,
  modifierScope: tracerModifierScopeAdapter,
  initiative: tracerInitiativeAdapter
}
