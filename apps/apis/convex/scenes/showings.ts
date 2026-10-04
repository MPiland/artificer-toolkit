import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { nullable } from 'zod/mini'
import { v } from 'convex/values'
import {
  campaignSceneShowingDtoSchema,
  campaignSceneShowingInputSchema,
  showCampaignSceneInputSchema,
  type CampaignSceneShowingDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { sceneStoredShowingSchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { query } from '../lib/queries'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireSceneMap } from '../media/vttMapDocuments'

/**
 * D87: a Scene shown to players as a view-only image. A plain Convex write, independent of the
 * presented Scene and of the live room: the room never reads or writes it.
 */
function readShowing(ctx: QueryCtx, campaignId: string) {
  return ctx.db
    .query('campaignSceneShowings')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
    .unique()
}

async function requireOwnedCampaign(ctx: MutationCtx, campaignId: string) {
  const { userId } = await requireIdentity(ctx)
  const { campaign, membership } = await requireCampaignAuthority(ctx, campaignId, userId)
  if (membership.role !== 'OWNER') throw new Error('Campaign not found.')
  return { campaign, userId }
}

export const current = query({
  args: zodToConvexFields(campaignSceneShowingInputSchema.shape),
  get returns() {
    return zodToConvex(nullable(campaignSceneShowingDtoSchema))
  },
  handler: async (ctx, args): Promise<CampaignSceneShowingDto | null> => {
    const input = campaignSceneShowingInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireCampaignAuthority(ctx, input.campaignId.toLowerCase(), userId)
    const showing = await readShowing(ctx, campaign.id)
    if (!showing) return null
    const scene = await ctx.db
      .query('campaignScenes')
      .withIndex('by_publicId', (q) => q.eq('id', showing.sceneId))
      .unique()
    if (!scene) return null
    return campaignSceneShowingDtoSchema.parse({
      sceneId: showing.sceneId,
      sceneName: scene.name,
      shownAt: showing.shownAt
    })
  }
})

export const show = mutation({
  args: zodToConvexFields(showCampaignSceneInputSchema.shape),
  returns: v.null(),
  handler: async (ctx, args) => {
    const input = showCampaignSceneInputSchema.parse(args)
    const { campaign, userId } = await requireOwnedCampaign(ctx, input.campaignId.toLowerCase())
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const sceneId = input.sceneId.toLowerCase()
    const scene = await ctx.db
      .query('campaignScenes')
      .withIndex('by_publicId', (q) => q.eq('id', sceneId))
      .unique()
    if (!scene || scene.campaignId !== campaign.id)
      throw new Error('Campaign live Scene was not found.')
    const presentation = await ctx.db
      .query('campaignScenePresentations')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
      .unique()
    if (presentation?.sceneId === sceneId)
      throw new Error('This Scene is already in front of players. It is the presented Scene.')
    await requireSceneMap(ctx, campaign.id, scene.map, null)
    const showing = sceneStoredShowingSchema.parse({
      campaignId: campaign.id,
      sceneId,
      shownBy: userId,
      shownAt: new Date().toISOString()
    })
    const existing = await readShowing(ctx, campaign.id)
    if (existing) await ctx.db.replace(existing._id, showing)
    else await ctx.db.insert('campaignSceneShowings', showing)
    return null
  }
})

export const stop = mutation({
  args: zodToConvexFields(campaignSceneShowingInputSchema.shape),
  returns: v.null(),
  handler: async (ctx, args) => {
    const input = campaignSceneShowingInputSchema.parse(args)
    const { campaign } = await requireOwnedCampaign(ctx, input.campaignId.toLowerCase())
    const existing = await readShowing(ctx, campaign.id)
    if (existing) await ctx.db.delete(existing._id)
    return null
  }
})
