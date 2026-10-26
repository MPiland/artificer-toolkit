import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterActorRelationshipKindDto } from '@artificer-toolkit/schema/shared/reaction'
import type { ReactionReachCandidate, SpatialMovementKind } from '@artificer-toolkit/shared/vtt'

import { encounterGrantsFreeOpportunityReaction } from './encounterActiveGrants.js'
import { encounterTurnUsageSnapshot } from './encounterActorState.js'

import {
  evaluateMovementReactionEligibility,
  type EvaluatedMovementReactionCandidate,
  type MovementReactionEligibilityFacts
} from './movementReactionEligibilityService.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import type { EncounterMovementReactionContact } from './encounterMovementReactionContacts.js'
import {
  encounterMovementReactionEvaluationSource,
  type EncounterMovementReactionEncounter,
  type EncounterMovementReactionEvaluationSource,
  type EncounterMovementReactionSource
} from './encounterMovementReactionSources.js'
import type { EncounterMovementReactionActorRuleState } from './encounterMovementReactionRuleState.js'

function relationshipKey(leftActorId: string, rightActorId: string): string {
  return [leftActorId, rightActorId].sort().join(':')
}

export async function evaluateEncounterMovementReactionContacts(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  movementKind: SpatialMovementKind
  contacts: readonly EncounterMovementReactionContact<EncounterMovementReactionSource>[]
  encounter: EncounterMovementReactionEncounter
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
  actorRuleStates: ReadonlyMap<string, EncounterMovementReactionActorRuleState>
  lockRelationship(input: {
    reactorActorId: string
    movingActorId: string
  }): Promise<EncounterActorRelationshipKindDto | null>
  resolvePerception(
    contact: EncounterMovementReactionContact<EncounterMovementReactionSource>
  ): Promise<boolean>
}): Promise<
  readonly EvaluatedMovementReactionCandidate<EncounterMovementReactionEvaluationSource>[]
> {
  const relationshipByActors = new Map<string, Promise<EncounterActorRelationshipKindDto | null>>()
  const candidates: {
    candidate: ReactionReachCandidate
    contactSourceId: string
    source: EncounterMovementReactionEvaluationSource
    facts: MovementReactionEligibilityFacts
  }[] = []
  for (const contact of [...input.contacts].sort(
    (left, right) =>
      left.candidate.pathDistance - right.candidate.pathDistance ||
      left.candidate.reactorActorId.localeCompare(right.candidate.reactorActorId) ||
      left.source.source.capability.actionId.localeCompare(right.source.source.capability.actionId)
  )) {
    const actorState = input.actorRuleStates.get(contact.candidate.reactorActorId)
    const reactor = input.encounter.actors.find(({ id }) => id === contact.candidate.reactorActorId)
    const moverEffects = input.activeEffectsByActorId.get(contact.candidate.movingActorId)
    if (!actorState || !reactor || !moverEffects)
      throw new Error('Movement reaction actor rule state was not resolved under lock.')
    const key = relationshipKey(contact.candidate.reactorActorId, contact.candidate.movingActorId)
    let relationship = relationshipByActors.get(key)
    if (!relationship) {
      relationship = input.lockRelationship({
        reactorActorId: contact.candidate.reactorActorId,
        movingActorId: contact.candidate.movingActorId
      })
      relationshipByActors.set(key, relationship)
    }
    candidates.push({
      candidate: contact.candidate,
      contactSourceId: contact.contactSourceId,
      source: encounterMovementReactionEvaluationSource(contact.source),
      facts: {
        capabilityState: actorState.capabilityState,
        perceptionSatisfied: await input.resolvePerception(contact),
        relationshipKind: await relationship,
        ruleUsage: actorState.ruleUsage,
        turnUsage: encounterTurnUsageSnapshot(reactor, input.encounter.turnSequence),
        freeOpportunityReactionGranted: encounterGrantsFreeOpportunityReaction({
          holderActorId: contact.candidate.movingActorId,
          effects: moverEffects,
          reactorActorId: reactor.id,
          turnActorId: input.encounter.currentActorId
        })
      }
    })
  }
  return evaluateMovementReactionEligibility({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    movementKind: input.movementKind,
    candidates
  })
}
