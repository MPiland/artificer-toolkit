import {
  liveSessionCheckpointInputSchema,
  type LiveSessionCheckpointInput,
  type LiveSessionCheckpointReason,
  type LiveSessionCheckpointResponse
} from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import { LIVE_SESSION_CHECKPOINT_MAX_BYTES } from '@artificer-toolkit/schema/api/liveSessionCheckpointFence'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import { callLiveSessionRoute, type NativeLiveSessionEnvironment } from './liveSessionRoutes.js'

/** What one publication cost the Worker: the payload it carried and the requests that took. */
interface RoomCheckpointPublication {
  response: LiveSessionCheckpointResponse
  payloadBytes: number
  requests: number
}

/** Publishes one fixed committed prefix; a failed request leaves acknowledgement to the caller. */
export async function publishRoomCheckpoint(
  environment: NativeLiveSessionEnvironment,
  input: LiveSessionCheckpointInput,
  reason: LiveSessionCheckpointReason
): Promise<RoomCheckpointPublication> {
  const validated = liveSessionCheckpointInputSchema.parse(input)
  const { records, payloadChecksum } = validated
  const recordsJson = canonicalizeJson(records)
  const byteLength = new TextEncoder().encode(recordsJson).byteLength
  if (byteLength > LIVE_SESSION_CHECKPOINT_MAX_BYTES)
    throw new Error('Checkpoint payload exceeds its byte limit.')
  if (sha256Hex(recordsJson) !== payloadChecksum)
    throw new Error('Checkpoint payload checksum does not match.')

  return {
    response: await callLiveSessionRoute(environment, null, 'checkpoint', {
      ...validated,
      reason
    }),
    payloadBytes: byteLength,
    requests: 1
  }
}
