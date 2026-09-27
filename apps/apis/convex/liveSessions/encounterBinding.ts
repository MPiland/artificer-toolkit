import { v } from 'convex/values'
import { liveSessionEncounterBindingCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type { BindEncounterToPresentedSceneResultDto } from '@artificer-toolkit/schema/api/vttScenes'
import { internalMutation } from '../lib/mutations'
import { bindEncounterToPresentedScene } from '../encounters/sceneBindings'
import { requireActiveCampaignLiveAuthority } from './authorityGuard'
import { requireLiveMember } from './liveMember'
import { commitWithAuthorityAdvance } from './externalCommit'

/**
 * Binds an Encounter to the room's presented Scene and advances the room's authority in the same
 * transaction (D47). Refused after `expiresAt`, which lets a resolve abandon it safely.
 */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const commit = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<BindEncounterToPresentedSceneResultDto> => {
    const input = liveSessionEncounterBindingCommitInputSchema.parse(args)
    await requireLiveMember(ctx, input)
    if (Date.now() > input.expiresAt) throw new Error('Live Encounter binding commit expired.')
    const authority = await requireActiveCampaignLiveAuthority(ctx, {
      campaignId: input.campaignId,
      epoch: input.authorityEpoch
    })
    const sceneId = input.sceneId.toLowerCase()
    const result = await commitWithAuthorityAdvance(
      ctx,
      input,
      () =>
        bindEncounterToPresentedScene(ctx, input.command, {
          sceneId,
          expectedPresentationVersion: input.presentation.expectedPresentationVersion
        }),
      (bound) => bound.sceneId === sceneId
    )
    // Only a retry of this room commit replays; a binding made with this command outside the room
    // never advanced the room's sequence, so the room must not apply it as its next command.
    if (result.replayed && authority.persistedSequence < input.authority.sequence)
      throw new Error('Live Encounter binding replays a binding made outside the room.')
    return result
  }
})
