import type { EncounterForcedMovementOfferDto } from '@artificer-toolkit/schema/shared/ruleExecutionForcedMovementChoice'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  MAX_FORCED_MOVEMENT_DESTINATIONS,
  type SpatialPointDto
} from '@artificer-toolkit/schema/shared/spatialFacts'

import type { PendingNativeActionGraphs } from './encounterActionExecution.js'
import {
  createReactionChoiceDefinition,
  resumeReactionChoice,
  startReactionChoice
} from './reactionChoiceDefinition.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

/** The System-owned bounded-choice graph that holds a forced movement until its source picks a square. */
export const ENCOUNTER_FORCED_MOVEMENT_CHOICE_DEFINITION_ID = '5b0d7e3c-91a4-4f6e-8c2d-3e7a19f04b62'

/**
 * Holds a settled action for its source to pick where the creature it moves lands (D157): the
 * sealed choice indexes the legal squares the room derived, in the order it offers them.
 */
export async function holdForForcedMovementDestination(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  completion: EncounterForcedMovementOfferDto['completion']
  outcomePhase: PendingNativeActionGraphs['twoPhase']
  targetActorId: string
  positions: readonly SpatialPointDto[]
}): Promise<PendingNativeActionGraphs> {
  return {
    kind: 'PENDING',
    continuation: await startReactionChoice({
      runtime: input.runtime,
      occurrenceId: input.occurrenceId,
      published: createReactionChoiceDefinition({
        definitionId: ENCOUNTER_FORCED_MOVEMENT_CHOICE_DEFINITION_ID,
        gameSystemId: input.completion.initialPublished.gameSystemId
      }),
      optionCount: input.positions.length,
      maxOptionCount: MAX_FORCED_MOVEMENT_DESTINATIONS
    }),
    d20Policy: null,
    twoPhase: input.outcomePhase,
    // A held OUTCOME keeps its sealed TEST receipt, as any OUTCOME pause does.
    ...(input.outcomePhase
      ? {
          phaseReceipts: (input.completion.phaseReceipts ?? []).filter(
            ({ phase }) => phase === 'TEST'
          )
        }
      : {}),
    roller: 'SOURCE',
    forcedMovementDestination: {
      completion: input.completion,
      targetActorId: input.targetActorId,
      positions: [...input.positions]
    }
  }
}

/** Settles the held choice with the square the source picked; a square the offer never held is refused. */
export async function settleForcedMovementDestination(input: {
  runtime: RulesRuntimeService
  continuation: ServerRuleExecutionContinuationDto
  offer: Pick<EncounterForcedMovementOfferDto, 'positions'>
  position: SpatialPointDto
}): Promise<SpatialPointDto> {
  const selectedIndex = input.offer.positions.findIndex(
    ({ x, y }) => x === input.position.x && y === input.position.y
  )
  if (selectedIndex < 0) throw new Error('The forced-movement destination was not offered.')
  await resumeReactionChoice({
    runtime: input.runtime,
    continuation: input.continuation,
    selectedIndex
  })
  return input.offer.positions[selectedIndex]!
}
