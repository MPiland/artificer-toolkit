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
 * Runs a room commit and advances the room's authority sequence in the same transaction (D27), so
 * Convex itself orders it after every earlier room command. A persisted sequence other than the one
 * before `authority.sequence`, or a result `matches` rejects, rolls everything back. A replay of an
 * already committed change does not advance again.
 */
export async function commitWithAuthorityAdvance<Result extends { replayed: boolean }>(
  ctx: MutationCtx,
  input: { campaignId: string; authorityEpoch: string; authority: LiveSessionExternalAuthority },
  commit: () => Promise<Result>,
  matches: (result: Result) => boolean
): Promise<Result> {
  const scope = { campaignId: input.campaignId, epoch: input.authorityEpoch }
  const authority = await requireActiveCampaignLiveAuthority(ctx, scope)
  const result = await commit()
  if (result.replayed) return result
  if (
    authority.persistedSequence !== input.authority.sequence - 1 ||
    authority.persistedStateChecksum !== input.authority.expectedStateChecksum
  )
    throw new Error('Live Session authority sequence is stale.')
  if (!matches(result)) throw new Error('Live commit differs from the room prediction.')
  await advanceCampaignLiveAuthorityPersisted(ctx, { ...scope, ...input.authority })
  return result
}

/** A room Scene commit: the published Scene must be the one the room predicted. */
export function publishWithAuthorityAdvance(
  ctx: MutationCtx,
  input: {
    campaignId: string
    authorityEpoch: string
    authority: LiveSessionExternalAuthority
    expectedScene: LiveSessionExpectedScene
  },
  publish: () => Promise<SceneGeometryCommandResult>
): Promise<SceneGeometryCommandResult> {
  return commitWithAuthorityAdvance(
    ctx,
    input,
    publish,
    (result) =>
      result.sceneId === input.expectedScene.sceneId &&
      result.version === input.expectedScene.version &&
      checksumCanonicalJson(result.delta) === checksumCanonicalJson(input.expectedScene.delta)
  )
}

/**
 * Settles a room commit the room did not see finish. COMMITTED when its change landed and the
 * authority reached the room's next sequence and checksum; ABANDONED when it did not land and the
 * authority remains at the room's sequence, after fencing it so a delayed commit fails: a still
 * receiving save expires, and a binding or prefetched movement answer (D64) resolves only after its
 * `expiresAt`, touching the authority so a commit still in flight conflicts and reruns past its
 * expiry. Anything else fails closed.
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
    const { subject } = input
    let landed: boolean
    let fence: () => Promise<void>
    if (subject.kind === 'SCENE_SAVE') {
      const row = await ctx.db
        .query('sceneGeometrySaves')
        .withIndex('by_publicId', (q) => q.eq('id', subject.saveId.toLowerCase()))
        .unique()
      if (!row) throw new Error('Scene geometry save is unavailable.')
      const save = parseGeometrySave(row)
      if (save.sessionVision?.campaignId !== input.campaignId.toLowerCase())
        throw new Error('Scene geometry save belongs to another Campaign.')
      landed = save.status === 'PUBLISHED'
      fence = async () => {
        if (save.status === 'RECEIVING') await ctx.db.patch(row._id, { status: 'EXPIRED' })
      }
    } else if (subject.kind === 'MOVEMENT_ANSWER') {
      // The answer stages its save in its own transaction: no row means it has not landed.
      const row = await ctx.db
        .query('sceneGeometrySaves')
        .withIndex('by_sceneId_commandId', (q) =>
          q
            .eq('sceneId', subject.sceneId.toLowerCase())
            .eq('commandId', subject.commandId.toLowerCase())
        )
        .unique()
      const save = row && parseGeometrySave(row)
      if (save && save.sessionVision?.campaignId !== input.campaignId.toLowerCase())
        throw new Error('Scene geometry save belongs to another Campaign.')
      landed = save?.status === 'PUBLISHED'
      fence = async () => {
        if (Date.now() <= subject.expiresAt)
          throw new Error('The movement answer commit may still land.')
        await ctx.db.patch(authority._id, { updatedAt: new Date().toISOString() })
      }
    } else {
      const binding = await ctx.db
        .query('encounterSceneBindings')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', subject.encounterId.toLowerCase()))
        .unique()
      landed =
        binding?.campaignId === input.campaignId.toLowerCase() &&
        binding.commandId === subject.commandId.toLowerCase()
      fence = async () => {
        if (Date.now() <= subject.expiresAt)
          throw new Error('The Encounter binding commit may still land.')
        await ctx.db.patch(authority._id, { updatedAt: new Date().toISOString() })
      }
    }
    if (
      landed &&
      authority.persistedSequence === input.expectedSequence + 1 &&
      authority.persistedStateChecksum === input.nextStateChecksum
    )
      return { outcome: 'COMMITTED' }
    if (
      !landed &&
      authority.persistedSequence === input.expectedSequence &&
      authority.persistedStateChecksum === input.expectedStateChecksum
    ) {
      await fence()
      return { outcome: 'ABANDONED' }
    }
    throw new Error('Live Session commit outcome is inconsistent.')
  }
})
