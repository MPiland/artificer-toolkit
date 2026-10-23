import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { MovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import { readNativeLiveHolderLight } from './nativeHolderLight.js'
import { readNativeLiveHasNotTakenTurn, readNativeLiveTurnUses } from './nativeTurnUses.js'

/** The room-store reads an attack's mechanics ask for about the turn and the holder's square. */
export function nativeActionStateLoaders(input: {
  campaignId: string
  actorId: string
  sceneContext: { sceneId: string; sceneVersion: number } | null
  capture: (request: LiveSessionEncounterRulesRequest) => Promise<LiveSessionEncounterRulesResponse>
}) {
  const { campaignId, actorId, sceneContext, capture } = input
  return {
    loadTurnUses: () => readNativeLiveTurnUses(capture, actorId),
    loadTargetHasNotTakenTurn: ({ targetFacts }: { targetFacts: MovementTarget }) =>
      readNativeLiveHasNotTakenTurn(capture, targetFacts.actor.id),
    loadHolderLight: ({ sourceFacts }: { sourceFacts: MovementTarget }) =>
      readNativeLiveHolderLight(campaignId, sourceFacts, sceneContext, capture)
  }
}
