import { v } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  liveSessionCheckpointRequestSchema,
  liveSessionCheckpointResponseSchema,
  type LiveSessionCheckpointAdoption,
  type LiveSessionCheckpointRequest,
  type LiveSessionCheckpointResponse
} from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import {
  liveSessionChatCheckpointInputSchema,
  type LiveSessionChatCheckpointInput
} from '@artificer-toolkit/schema/api/liveSessionChatCheckpoint'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  LIVE_SESSION_CHECKPOINT_MAX_BYTES,
  type LiveSessionCheckpointFenceInput
} from '@artificer-toolkit/schema/api/liveSessionCheckpointFence'
import type { MutationCtx } from '../_generated/server'
import {
  untrackedInternalMutation,
  withBatchedSceneVisionTracking,
  type BatchedSceneVisionTracking
} from '../lib/mutations'
import { commitCampaignLiveCheckpoint, presentCampaignLiveAuthority } from './authority'
import { requireCampaignLiveAuthority } from './authorityGuard'
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
  return publishCheckpointFrame(rawCtx, frame, (tracking, io) =>
    applyCheckpointRecords(tracking, frame, records, knownAuthorization, io)
  )
}

/**
 * Inline and staged payloads share exactly the same publication transaction. The response carries
 * no authorization: the room renews its lease with its own read (ADR 0035 Amendment 18).
 */
export async function publishCheckpointFrame(
  rawCtx: MutationCtx,
  frame: LiveSessionCheckpointFenceInput,
  apply: (
    tracking: BatchedSceneVisionTracking,
    io: CheckpointIoMeter
  ) => Promise<LiveSessionCheckpointAdoption>
): Promise<LiveSessionCheckpointResponse> {
  // Refresh outside-view revisions without invalidating the room's own committed inputs.
  const tracking = withBatchedSceneVisionTracking(rawCtx)
  const io = createCheckpointIoMeter(rawCtx)
  const result = await commitCampaignLiveCheckpoint(tracking.ctx, frame, async () => {
    await io.mark('fence')
    return apply(tracking, io)
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

/**
 * A mid-Run chat save (ADR 0035 Amendment 32). It runs under the epoch fence but never moves the
 * authority head, so the room may send the same input again until it is acknowledged: a change whose
 * next state is already stored is skipped, and any other mismatch rejects.
 */
export async function publishChatCheckpoint(
  ctx: MutationCtx,
  rawInput: LiveSessionChatCheckpointInput
): Promise<LiveSessionCheckpointResponse> {
  const { campaignId, epoch, changes, retainedRolls, knownAuthorization } =
    liveSessionChatCheckpointInputSchema.parse(rawInput)
  const authority = await requireCampaignLiveAuthority(ctx, { campaignId, epoch })
  if (authority.phase === 'ACTIVATING') throw new Error('Live Session authority is not active.')
  // The same revision tracking and adoption as a full save, so the room's own writes never look foreign.
  const tracking = withBatchedSceneVisionTracking(ctx)
  const io = createCheckpointIoMeter(ctx)
  await io.mark('fence')
  const adopted = await applyCheckpointRecords(
    tracking,
    { campaignId, epoch, checkpointId: crypto.randomUUID() },
    { changes, history: [], scenes: [], retainedRolls },
    knownAuthorization,
    io,
    { replay: true }
  )
  return liveSessionCheckpointResponseSchema.parse({
    status: 'COMMITTED',
    authority: presentCampaignLiveAuthority(authority),
    adopted,
    io: await io.finish()
  })
}

export const publish = untrackedInternalMutation({
  args: () => v.any(),
  returns: () => zodToConvex(liveSessionCheckpointResponseSchema),
  handler: publishCheckpoint
})

export const publishChat = untrackedInternalMutation({
  args: () => v.any(),
  returns: () => zodToConvex(liveSessionCheckpointResponseSchema),
  handler: publishChatCheckpoint
})
