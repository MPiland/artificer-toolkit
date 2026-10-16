import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'

/** The once-per-turn uses an actor has spent this turn (D119), read from the room's store. */
export async function readNativeLiveTurnUses(
  capture: (request: LiveSessionEncounterRulesRequest) => Promise<LiveSessionEncounterRulesResponse>,
  actorId: string
): Promise<readonly string[]> {
  const captured = await capture({ kind: 'TURN_USES', actorId })
  if (captured.kind !== 'TURN_USES') throw new Error('Turn uses are unavailable.')
  return captured.keys
}
