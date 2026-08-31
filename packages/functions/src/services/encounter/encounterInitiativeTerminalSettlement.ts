import type { EncounterInitiativeLifecycleResult } from './encounterInitiativeLifecycle.js'
import type { EncounterInitiativeOccurrenceRoot } from './encounterInitiativeOccurrence.js'

import { EncounterConflictError } from './encounterErrors.js'

type SettledInitiative = Extract<EncounterInitiativeLifecycleResult, { kind: 'SETTLED' }>

export function assertEncounterInitiativeTerminalOrder(input: {
  sealedRound: number
  settledRound: number
  participantActorIds: readonly string[]
  orderedActorIds: readonly string[]
}): void {
  if (input.settledRound !== input.sealedRound)
    throw new EncounterConflictError('Initiative settlement does not match its sealed round.')
  const participantActorIds = new Set(input.participantActorIds)
  if (
    input.orderedActorIds.length !== input.participantActorIds.length ||
    new Set(input.orderedActorIds).size !== input.orderedActorIds.length ||
    input.orderedActorIds.some((actorId) => !participantActorIds.has(actorId))
  ) {
    throw new EncounterConflictError('Initiative settlement does not retain one exact actor order.')
  }
}

/**
 * Establishes the one terminal boundary shared by all initiative evidence and
 * declaration paths. The caller already holds the Encounter/occurrence locks;
 * this verifies that the sealed root still describes the exact settled round
 * before it applies any turn effects, cursor change, receipt, or projection.
 */
export function requireEncounterInitiativeTerminalSettlement(input: {
  root: EncounterInitiativeOccurrenceRoot
  result: EncounterInitiativeLifecycleResult
}): SettledInitiative {
  if (input.result.kind !== 'SETTLED')
    throw new EncounterConflictError('Initiative has not reached its terminal settlement.')
  assertEncounterInitiativeTerminalOrder({
    sealedRound: input.root.round,
    settledRound: input.result.state.round.round,
    participantActorIds: input.result.state.participants.map((participant) => participant.actorId),
    orderedActorIds: input.result.orderedActorIds
  })
  return input.result
}
