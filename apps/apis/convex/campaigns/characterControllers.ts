import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignAssignmentResultSchema,
  setCampaignCharacterControllersInputSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { mutation } from '../lib/mutations'
import { requireCampaignAuthority } from './authority'

/**
 * The GM gives Campaign members control of an assigned Character, or takes it back (SCENE-5.1,
 * D162). The list is the whole grant: it replaces the previous one, and the assigned player always
 * keeps control. Rooms and Runs derive control from it, so a change applies at once.
 */
export const setControllers = mutation({
  args: zodToConvexFields(setCampaignCharacterControllersInputSchema.shape),
  returns: zodToConvex(campaignAssignmentResultSchema),
  handler: async (ctx, args) => {
    const input = setCampaignCharacterControllersInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== 'OWNER') throw new Error('Only the Campaign GM can grant control.')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const characterId = input.characterId.toLowerCase()
    const assignment = await ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .unique()
    if (assignment?.campaignId !== campaign.id) throw new Error('Assigned Character not found.')
    const controllerUserIds = input.controllerUserIds.map((id) => id.toLowerCase())
    for (const controllerUserId of controllerUserIds) {
      const member = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', campaign.id).eq('userId', controllerUserId)
        )
        .unique()
      if (member?.status !== 'ACTIVE' || member.role !== 'PLAYER')
        throw new Error('Character controllers must be current Campaign players.')
      if (controllerUserId === assignment.userId)
        throw new Error('The assigned player always controls their Character.')
    }
    await ctx.db.patch(assignment._id, { controllerUserIds })
    return { ok: true as const }
  }
})

/** A departed member stops controlling every Character, so rejoining later grants nothing back. */
export async function removeCampaignCharacterController(
  ctx: MutationCtx,
  campaign: Doc<'campaigns'>,
  userId: string
): Promise<void> {
  for (const assignment of await ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
    .collect())
    if (assignment.controllerUserIds?.includes(userId))
      await ctx.db.patch(assignment._id, {
        controllerUserIds: assignment.controllerUserIds.filter((id) => id !== userId)
      })
}
