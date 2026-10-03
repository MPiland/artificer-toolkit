import {
  liveSessionCheckpointInputSchema,
  type LiveSessionCheckpointInput,
  type LiveSessionCheckpointReason,
  type LiveSessionCheckpointResponse
} from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import { LIVE_SESSION_CHECKPOINT_MAX_BYTES } from '@artificer-toolkit/schema/api/liveSessionCheckpointFence'
import { encodeBase64 } from '@artificer-toolkit/shared/base64'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  encodeUtf8PayloadChunks,
  JSON_PAYLOAD_CHUNK_MAX_BYTES
} from '@artificer-toolkit/shared/jsonPayloadChunks'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import { callLiveSessionRoute, type NativeLiveSessionEnvironment } from './liveSessionRoutes.js'

/** What one publication cost the Worker: the payload it carried and the requests that took. */
export interface RoomCheckpointPublication {
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
  const { records, knownAuthorization, ...frame } = validated
  const recordsJson = canonicalizeJson(records)
  const byteLength = new TextEncoder().encode(recordsJson).byteLength
  if (byteLength > LIVE_SESSION_CHECKPOINT_MAX_BYTES)
    throw new Error('Checkpoint payload exceeds its byte limit.')
  if (sha256Hex(recordsJson) !== frame.payloadChecksum)
    throw new Error('Checkpoint payload checksum does not match.')

  if (
    new TextEncoder().encode(JSON.stringify(validated)).byteLength <= JSON_PAYLOAD_CHUNK_MAX_BYTES
  )
    return {
      response: await callLiveSessionRoute(environment, null, 'checkpoint', {
        ...validated,
        reason
      }),
      payloadBytes: byteLength,
      requests: 1
    }

  const parts = encodeUtf8PayloadChunks(recordsJson)
  const staged = await callLiveSessionRoute(environment, null, 'checkpointStage', {
    ...frame,
    byteLength,
    partCount: parts.length
  })
  let requests = 2
  if (staged.status !== 'REPLAYED') {
    for (const [index, part] of parts.entries()) {
      await callLiveSessionRoute(environment, null, 'checkpointPart', {
        campaignId: frame.campaignId,
        epoch: frame.epoch,
        checkpointId: frame.checkpointId,
        index,
        data: encodeBase64(new Uint8Array(part))
      })
      requests += 1
    }
  }
  return {
    response: await callLiveSessionRoute(environment, null, 'checkpointCommit', {
      ...frame,
      knownAuthorization,
      reason
    }),
    payloadBytes: byteLength,
    requests
  }
}
