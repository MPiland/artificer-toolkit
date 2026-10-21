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

/** An actor's latest voluntary move this turn (D164), read from the room's store. */
export async function readNativeLiveTurnLastMove(
  capture: (
    request: LiveSessionEncounterRulesRequest
  ) => Promise<LiveSessionEncounterRulesResponse>,
  actorId: string
) {
  const captured = await capture({ kind: 'TURN_LAST_MOVE', actorId })
  if (captured.kind !== 'TURN_LAST_MOVE') throw new Error('Turn movement is unavailable.')
  return captured.lastMove
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
