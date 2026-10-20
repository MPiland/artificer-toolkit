import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'

/** The feet an actor has moved this turn, read from the room's store. */
export async function readNativeLiveTurnMovedFeet(
  capture: (
    request: LiveSessionEncounterRulesRequest
  ) => Promise<LiveSessionEncounterRulesResponse>,
  actorId: string
): Promise<number> {
  const captured = await capture({ kind: 'TURN_MOVED_FEET', actorId })
  if (captured.kind !== 'TURN_MOVED_FEET') throw new Error('Turn movement is unavailable.')
  return captured.feet
}

/** The once-per-turn uses an actor has spent this turn (D119), read from the room's store. */
export async function readNativeLiveTurnUses(
  capture: (
    request: LiveSessionEncounterRulesRequest
  ) => Promise<LiveSessionEncounterRulesResponse>,
  actorId: string
): Promise<readonly string[]> {
  const captured = await capture({ kind: 'TURN_USES', actorId })
  if (captured.kind !== 'TURN_USES') throw new Error('Turn uses are unavailable.')
  return captured.keys
}

/**
 * Whether an actor has yet to take a turn in the Encounter: it is READY in the first round's
 * initiative, read from the room's store. Later rounds mean every actor has had a turn.
 */
export async function readNativeLiveHasNotTakenTurn(
  capture: (
    request: LiveSessionEncounterRulesRequest
  ) => Promise<LiveSessionEncounterRulesResponse>,
  actorId: string
): Promise<boolean> {
  const captured = await capture({ kind: 'INITIATIVE_ROUND' })
  if (captured.kind !== 'INITIATIVE_ROUND') throw new Error('Turn initiative is unavailable.')
  const { state } = captured
  return (
    state !== null &&
    state.round.round === 1 &&
    state.participants.some(
      (participant) => participant.actorId === actorId && participant.status === 'READY'
    )
  )
}
