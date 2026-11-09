import { zodToConvexFields } from 'convex-helpers/server/zod4'
import { v } from 'convex/values'
import { characterDeleteInputSchema } from '@artificer-toolkit/schema/api/characterDrafts'
import { removeMissingCharacterActors } from '@artificer-toolkit/encounter-persistence/actorRemovalCommand'
import { requireCampaignAuthority } from '../campaigns/authority'
import { removeCampaignCharacterAssignment } from '../campaigns/characterDeparture'
import { encounterWriteTransaction } from '../encounters/encounterPorts'
import { requireIdentity } from '../lib/identity'
import { mutation } from '../lib/mutations'
import { readLiveCampaignAuthority } from '../liveSessions/authorityGuard'
import { releaseAsset } from '../media/assets'
import { notifyCampaignRoom, removePrivateCharacter } from './accountDeletion'
import { loadCharacterState, resolveCharacterId } from './documents'

/**
 * The owner permanently deletes one Character, active or draft-only (BUILDER-5). A Character in a
 * Campaign leaves its Party as on account departure; the open Runs lose its actor here, or at the
 * room's departure reconcile while a live room holds them (D74). Anyone else, or no one signed in,
 * is told the Character is unavailable.
 */
export const remove = mutation({
  args: () => zodToConvexFields(characterDeleteInputSchema.shape),
  returns: () => v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    const input = characterDeleteInputSchema.parse(args)
    const characterId = await resolveCharacterId(ctx, input.id)
    const { active, draft } = characterId
      ? await loadCharacterState(ctx, characterId)
      : { active: null, draft: null }
    if (!characterId || (!active && !draft) || (active ?? draft)?.userId !== userId)
      throw new Error('Character is unavailable.')

    const assignment = await ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .unique()
    const campaign = assignment
      ? (await requireCampaignAuthority(ctx, assignment.campaignId, userId)).campaign
      : null
    if (assignment && campaign)
      await removeCampaignCharacterAssignment({
        ctx,
        campaign,
        assignment,
        actorUserId: userId,
        reason: 'CHARACTER_DELETED'
      })
    await removePrivateCharacter(ctx, userId, characterId, active, draft)
    if (active?.portraitAssetId) await releaseAsset(ctx, active.portraitAssetId)
    if (campaign) {
      if (await readLiveCampaignAuthority(ctx, campaign.id))
        await notifyCampaignRoom(ctx, campaign.id)
      else
        await removeMissingCharacterActors(
          encounterWriteTransaction(ctx),
          campaign,
          campaign.ownerUserId,
          async (id) => id === characterId
        )
    }
    return { ok: true as const }
  }
})
