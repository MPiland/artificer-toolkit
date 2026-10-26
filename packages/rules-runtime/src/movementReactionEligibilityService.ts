import {
  movementReactionEligibilityOutputDtoSchema,
  type EncounterActorRelationshipKindDto,
  type MovementReactionEligibilityOutputDto,
  type ReactionMovementTriggerBindingDto
} from '@artificer-toolkit/schema/shared/reaction'
import type { ServerCompletedRuleExecutionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { ResolvedRuleCapabilityStateDto } from '@artificer-toolkit/schema/shared/ruleState'
import type { ReactionReachCandidate, SpatialMovementKind } from '@artificer-toolkit/shared/vtt'

import { movementReactionEligibilityCapabilityRegistry } from './platformEncounterPolicy.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

export interface MovementReactionEligibilitySource {
  binding: ReactionMovementTriggerBindingDto
  capability: {
    actionId: string
    gameSystemId: string
  }
}

export interface MovementReactionEligibilityFacts {
  capabilityState: ResolvedRuleCapabilityStateDto
  perceptionSatisfied: boolean
  relationshipKind: EncounterActorRelationshipKindDto | null
  /** Raw aggregate-owned UUID-keyed usage. System policy selects its definition. */
  ruleUsage: Readonly<Record<string, number>>
  /** This turn's `EACH_TURN` usage, UUID-keyed like `ruleUsage`; other turns' entries have lapsed. */
  turnUsage: Readonly<Record<string, number>>
  /** The mover holds a `FREE_OPPORTUNITY_REACTION` grant whose event scope admits this reactor. */
  freeOpportunityReactionGranted: boolean
}

export interface EvaluatedMovementReactionCandidate<
  TSource extends MovementReactionEligibilitySource = MovementReactionEligibilitySource
> {
  candidate: ReactionReachCandidate
  source: TSource
  policy: MovementReactionEligibilityOutputDto
  evidence: ServerCompletedRuleExecutionDto['evidence']
}

export interface MovementReactionEligibilityAdapter {
  gameSystemId: string
  requiredCapabilityDefinitionIds: readonly string[]
  evaluate(input: {
    runtime: RulesRuntimeService
    occurrenceId: string
    movementKind: SpatialMovementKind
    candidate: ReactionReachCandidate
    source: MovementReactionEligibilitySource
    facts: MovementReactionEligibilityFacts
  }): Promise<{
    policy: unknown
    evidence: ServerCompletedRuleExecutionDto['evidence']
  }>
}

/**
 * Evaluates exact geometry contacts through their UUID-bound System policy.
 * The caller owns authoritative locks and factual derivation; this service
 * neither discovers mutable state nor branches on authored labels/features.
 */
export async function evaluateMovementReactionEligibility<
  TSource extends MovementReactionEligibilitySource
>(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  movementKind: SpatialMovementKind
  candidates: readonly {
    candidate: ReactionReachCandidate
    contactSourceId: string
    source: TSource
    facts: MovementReactionEligibilityFacts
  }[]
}): Promise<readonly EvaluatedMovementReactionCandidate<TSource>[]> {
  const evaluated: EvaluatedMovementReactionCandidate<TSource>[] = []
  for (const entry of input.candidates) {
    if (
      entry.candidate.sourceId !== entry.contactSourceId ||
      entry.candidate.stage !== entry.source.binding.stage
    ) {
      throw new Error('Movement reaction contact does not match its exact authored capability.')
    }
    const adapter = movementReactionEligibilityCapabilityRegistry.require(
      entry.source.capability.gameSystemId
    )
    const result = await adapter.evaluate({
      runtime: input.runtime,
      occurrenceId: input.occurrenceId,
      movementKind: input.movementKind,
      ...entry
    })
    if (
      result.evidence.source.definitionId !== entry.source.binding.eligibilityDefinitionId ||
      result.evidence.source.gameSystemId !== entry.source.capability.gameSystemId
    ) {
      throw new Error('Movement reaction eligibility evidence does not match its exact source.')
    }
    evaluated.push({
      candidate: entry.candidate,
      source: entry.source,
      policy: movementReactionEligibilityOutputDtoSchema.parse(result.policy),
      evidence: result.evidence
    })
  }
  return evaluated
}

export function requireMovementReactionCapabilityDefinitionIds(
  gameSystemId: string
): readonly string[] {
  return [
    ...movementReactionEligibilityCapabilityRegistry.require(gameSystemId)
      .requiredCapabilityDefinitionIds
  ]
}
