import {
  liveSessionEncounterTurnPendingInputSchema,
  type LiveSessionEncounterTurnPendingInput,
  liveSessionEncounterTurnCommitInputSchema,
  type LiveSessionEncounterTurnCommitInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterTurn'
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { requestNativeLiveSession, type NativeLiveSessionEnvironment } from './nativeSceneClient.js'

/** Publishes one pending ADVANCE_TURN only after the Convex transaction accepts its fences. */
export function commitNativeLiveEncounterTurnPending(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  input: LiveSessionEncounterTurnPendingInput
) {
  return requestNativeLiveSession(
    environment,
    accessToken,
    '/live-sessions/encounter-turn-pending',
    liveSessionEncounterTurnPendingInputSchema.parse(input),
    (body) => encounterCommandResultDtoSchema.parse(body)
  )
}

export function commitNativeLiveEncounterTurn(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  input: LiveSessionEncounterTurnCommitInput
) {
  return requestNativeLiveSession(
    environment,
    accessToken,
    '/live-sessions/encounter-turn',
    liveSessionEncounterTurnCommitInputSchema.parse(input),
    (body) => encounterCommandResultDtoSchema.parse(body)
  )
}
