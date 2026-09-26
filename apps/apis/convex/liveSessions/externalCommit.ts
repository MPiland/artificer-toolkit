import { v } from 'convex/values'
import {
  liveSessionExternalCommitResolveInputSchema,
  type LiveSessionExpectedScene,
  type LiveSessionExternalAuthority
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type { SceneGeometryCommandResult } from '@artificer-toolkit/schema/api/sceneGeometry'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { MutationCtx } from '../_generated/server'
import { internalMutation } from '../lib/mutations'
import { parseGeometrySave } from '../scenes/geometryDocuments'
import { advanceCampaignLiveAuthorityPersisted } from './authority'
import { requireActiveCampaignLiveAuthority, requireCampaignLiveAuthority } from './authorityGuard'

/**
 * Publishes a room Scene commit and advances the room's authority sequence in the same transaction
 * (D27), so Convex itself orders it after every earlier room command. A different Scene result than
 * the room predicted, or a persisted sequence other than the one before `authority.sequence`, rolls
 * everything back. A replay of an already published save does not advance again.
 */
export async function publishWithAuthorityAdvance(
  ctx: MutationCtx,
  input: {
    campaignId: string
    authorityEpoch: string
    authority: LiveSessionExternalAuthority
    expectedScene: LiveSessionExpectedScene
  },
  publish: () => Promise<SceneGeometryCommandResult>
): Promise<SceneGeometryCommandResult> {
  const scope = { campaignId: input.campaignId, epoch: input.authorityEpoch }
  const authority = await requireActiveCampaignLiveAuthority(ctx, scope)
  const result = await publish()
  if (result.replayed) return result
  if (
    authority.persistedSequence !== input.authority.sequence - 1 ||
    authority.persistedStateChecksum !== input.authority.expectedStateChecksum
  )
    throw new Error('Live Session authority sequence is stale.')
  if (
    result.sceneId !== input.expectedScene.sceneId ||
    result.version !== input.expectedScene.version ||
    checksumCanonicalJson(result.delta) !== checksumCanonicalJson(input.expectedScene.delta)
  )
    throw new Error('Live Scene publication differs from the room prediction.')
  await advanceCampaignLiveAuthorityPersisted(ctx, { ...scope, ...input.authority })
  return result
}

/**
 * Settles a room commit the room did not see finish. COMMITTED when the save published and the
 * authority reached the room's next sequence and checksum; ABANDONED after expiring a still
 * receiving save while the authority remains at the room's sequence, so a delayed commit fails.
 * Anything else fails closed.
 */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const resolve = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<{ outcome: 'COMMITTED' | 'ABANDONED' }> => {
    const input = liveSessionExternalCommitResolveInputSchema.parse(args)
    const authority = await requireCampaignLiveAuthority(ctx, {
      campaignId: input.campaignId,
      epoch: input.epoch
    })
    if (authority.phase === 'ACTIVATING') throw new Error('Live Session authority is not active.')
    const row = await ctx.db
      .query('sceneGeometrySaves')
      .withIndex('by_publicId', (q) => q.eq('id', input.saveId.toLowerCase()))
      .unique()
    if (!row) throw new Error('Scene geometry save is unavailable.')
    const save = parseGeometrySave(row)
    if (save.sessionVision?.campaignId !== input.campaignId.toLowerCase())
      throw new Error('Scene geometry save belongs to another Campaign.')
    if (
      save.status === 'PUBLISHED' &&
      authority.persistedSequence === input.expectedSequence + 1 &&
      authority.persistedStateChecksum === input.nextStateChecksum
    )
      return { outcome: 'COMMITTED' }
    if (
      save.status !== 'PUBLISHED' &&
      authority.persistedSequence === input.expectedSequence &&
      authority.persistedStateChecksum === input.expectedStateChecksum
    ) {
      if (save.status === 'RECEIVING') await ctx.db.patch(row._id, { status: 'EXPIRED' })
      return { outcome: 'ABANDONED' }
    }
    throw new Error('Live Session commit outcome is inconsistent.')
  }
})
