import { v } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  liveSessionCheckpointInputSchema,
  liveSessionCheckpointResponseSchema,
  type LiveSessionCheckpointInput,
  type LiveSessionCheckpointResponse
} from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  LIVE_SESSION_CHECKPOINT_MAX_BYTES,
  type LiveSessionCheckpointFenceInput
} from '@artificer-toolkit/schema/api/liveSessionCheckpointFence'
import type { LiveSessionRoomAuthorizationRevisions } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type { MutationCtx } from '../_generated/server'
import { untrackedInternalMutation, withSceneVisionTracking } from '../lib/mutations'
import { commitCampaignLiveCheckpoint, presentCampaignLiveAuthority } from './authority'
import { applyCheckpointRecords } from './checkpointRecords'
import { readRoomAuthorization } from './roomAuthorization'

/** Mutable deltas, packed history, and the replay fence share the caller's native transaction. */
export async function publishCheckpoint(
  rawCtx: MutationCtx,
  rawInput: LiveSessionCheckpointInput
): Promise<LiveSessionCheckpointResponse> {
  const { records, knownAuthorization, ...frame } = liveSessionCheckpointInputSchema.parse(rawInput)
  if (
    new TextEncoder().encode(canonicalizeJson(records)).byteLength >
    LIVE_SESSION_CHECKPOINT_MAX_BYTES
  )
    throw new Error('Live Session checkpoint payload exceeds its journal page bound.')
  if (checksumCanonicalJson(records) !== frame.payloadChecksum)
    throw new Error('Live Session checkpoint payload checksum does not match.')
  return publishCheckpointFrame(rawCtx, frame, knownAuthorization, (ctx) =>
    applyCheckpointRecords(ctx, frame, records)
  )
}

/** Inline and staged payloads share exactly the same publication and authorization transaction. */
export async function publishCheckpointFrame(
  rawCtx: MutationCtx,
  frame: LiveSessionCheckpointFenceInput,
  knownAuthorization: LiveSessionRoomAuthorizationRevisions | null,
  apply: (ctx: MutationCtx) => Promise<void>
): Promise<LiveSessionCheckpointResponse> {
  // Refresh outside-view revisions without invalidating the room's own committed inputs.
  const ctx = withSceneVisionTracking(rawCtx)
  const result = await commitCampaignLiveCheckpoint(ctx, frame, () => apply(ctx))
  return liveSessionCheckpointResponseSchema.parse({
    status: result.status,
    authority: presentCampaignLiveAuthority(result.authority),
    authorization: await readRoomAuthorization(ctx, {
      campaignId: frame.campaignId,
      epoch: frame.epoch,
      known: knownAuthorization
    })
  })
}

export const publish = untrackedInternalMutation({
  args: v.any(),
  returns: zodToConvex(liveSessionCheckpointResponseSchema),
  handler: publishCheckpoint
})
