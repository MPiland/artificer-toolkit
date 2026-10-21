import type { EncounterForcedMovementOfferDto } from '@artificer-toolkit/schema/shared/ruleExecutionForcedMovementChoice'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  MAX_FORCED_MOVEMENT_DESTINATIONS,
  type SpatialPointDto
} from '@artificer-toolkit/schema/shared/spatialFacts'

import type { PendingNativeActionGraphs } from './encounterActionExecution.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { openEncounterSealedChoice, settleEncounterSealedChoice } from './encounterSealedChoice.js'

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
    // A forced movement always lands: every index is a square, none declines.
    continuation: await openEncounterSealedChoice({
      runtime: input.runtime,
      occurrenceId: input.occurrenceId,
      graph: {
        definitionId: ENCOUNTER_FORCED_MOVEMENT_CHOICE_DEFINITION_ID,
        gameSystemId: input.completion.initialPublished.gameSystemId
      },
      optionCount: input.positions.length,
      declinable: false,
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
    pause: {
      kind: 'FORCED_MOVEMENT',
      payload: {
        completion: input.completion,
        targetActorId: input.targetActorId,
        positions: [...input.positions]
      }
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
  await settleEncounterSealedChoice({
    runtime: input.runtime,
    continuation: input.continuation,
    selectedIndex,
    label: 'Forced-movement destination'
  })
  return input.offer.positions[selectedIndex]!
}
