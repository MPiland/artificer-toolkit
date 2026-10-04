import { v } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  liveSessionCheckpointRequestSchema,
  liveSessionCheckpointResponseSchema,
  type LiveSessionCheckpointAdoption,
  type LiveSessionCheckpointRequest,
  type LiveSessionCheckpointResponse
} from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  LIVE_SESSION_CHECKPOINT_MAX_BYTES,
  type LiveSessionCheckpointFenceInput
} from '@artificer-toolkit/schema/api/liveSessionCheckpointFence'
import type { MutationCtx } from '../_generated/server'
import { untrackedInternalMutation, withSceneVisionTracking } from '../lib/mutations'
import { commitCampaignLiveCheckpoint, presentCampaignLiveAuthority } from './authority'
import { createCheckpointIoMeter, type CheckpointIoMeter } from './checkpointIo'
import { applyCheckpointRecords } from './checkpointRecords'

/** Mutable deltas, packed history, and the replay fence share the caller's native transaction. */
export async function publishCheckpoint(
  rawCtx: MutationCtx,
  rawInput: LiveSessionCheckpointRequest
): Promise<LiveSessionCheckpointResponse> {
  const {
    records,
    knownAuthorization,
    reason: _reason,
    ...frame
  } = liveSessionCheckpointRequestSchema.parse(rawInput)
  if (
    new TextEncoder().encode(canonicalizeJson(records)).byteLength >
    LIVE_SESSION_CHECKPOINT_MAX_BYTES
  )
    throw new Error('Live Session checkpoint payload exceeds its journal page bound.')
  if (checksumCanonicalJson(records) !== frame.payloadChecksum)
    throw new Error('Live Session checkpoint payload checksum does not match.')
  return publishCheckpointFrame(rawCtx, frame, (ctx, io) =>
    applyCheckpointRecords(ctx, frame, records, knownAuthorization, io)
  )
}

/**
 * Inline and staged payloads share exactly the same publication transaction. The response carries
 * no authorization: the room renews its lease with its own read (ADR 0035 Amendment 18).
 */
export async function publishCheckpointFrame(
  rawCtx: MutationCtx,
  frame: LiveSessionCheckpointFenceInput,
  apply: (ctx: MutationCtx, io: CheckpointIoMeter) => Promise<LiveSessionCheckpointAdoption>
): Promise<LiveSessionCheckpointResponse> {
  // Refresh outside-view revisions without invalidating the room's own committed inputs.
  const ctx = withSceneVisionTracking(rawCtx)
  const io = createCheckpointIoMeter(rawCtx)
  const result = await commitCampaignLiveCheckpoint(ctx, frame, async () => {
    await io.mark('fence')
    return apply(ctx, io)
  })
  // The authority patch, or the whole replay check, belongs to the fence too.
  await io.mark('fence')
  // Measured last so the room meter sees the whole transaction (D85); the response is not metered.
  return liveSessionCheckpointResponseSchema.parse({
    status: result.status,
    authority: presentCampaignLiveAuthority(result.authority),
    adopted: result.status === 'COMMITTED' ? result.applied : { characters: [] },
    io: await io.finish()
  })
}

export const publish = untrackedInternalMutation({
  args: v.any(),
  returns: zodToConvex(liveSessionCheckpointResponseSchema),
  handler: publishCheckpoint
})
