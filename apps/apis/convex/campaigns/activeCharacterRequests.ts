import { v } from 'convex/values'
import * as zMini from 'zod/mini'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import {
  campaignActiveCharacterRequestDtoSchema,
  campaignActiveCharacterRequestInputSchema,
  campaignIdInputSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { query } from '../lib/queries'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import {
  deleteActiveCharacterRequests,
  readActiveCharacterRequest,
  switchActiveCharacter
} from './activeCharacterSwitch'

/** The player's own open request to swap their Active Character mid-fight (D236), or null. */
export const mine = query({
  args: () => zodToConvexFields(campaignIdInputSchema.shape),
  returns: () => zodToConvex(zMini.nullable(campaignActiveCharacterRequestDtoSchema)),
  handler: async (ctx, args) => {
    const { campaignId } = campaignIdInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireCampaignAuthority(ctx, campaignId, userId)
    const request = await readActiveCharacterRequest(ctx, campaign.id, userId)
    return request && toRequestDto(ctx, request)
  }
})

/** Every open request in the Campaign, for the GM to approve or decline (D236). */
export const list = query({
  args: () => zodToConvexFields(campaignIdInputSchema.shape),
  returns: () => zodToConvex(zMini.array(campaignActiveCharacterRequestDtoSchema)),
  handler: async (ctx, args) => {
    const { campaignId } = campaignIdInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, campaignId, userId)
    if (membership.role !== 'OWNER') rejectDomain('CAMPAIGN_NOT_FOUND')
    const requests = await ctx.db
      .query('campaignActiveCharacterRequests')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
      .collect()
    const dtos = await Promise.all(requests.map((request) => toRequestDto(ctx, request)))
    return dtos.sort((left, right) => left.requestedAt.localeCompare(right.requestedAt))
  }
})

export const cancel = mutation({
  args: () => zodToConvexFields(campaignIdInputSchema.shape),
  returns: () => v.null(),
  handler: async (ctx, args) => {
    const { campaignId } = campaignIdInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireCampaignAuthority(ctx, campaignId, userId)
    await deleteActiveCharacterRequests(ctx, campaign.id, userId)
    return null
  }
})

/**
 * The GM approves: the requested Character becomes the player's Active Character, as a free switch
 * would make it, provided both Characters are still attached as they were asked.
 */
export const approve = mutation({
  args: () => zodToConvexFields(campaignActiveCharacterRequestInputSchema.shape),
  returns: () => v.null(),
  handler: async (ctx, args) => {
    const { campaign, request } = await requireGmRequest(ctx, args)
    const attached = await ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', campaign.id).eq('userId', request.userId)
      )
      .collect()
    const from = attached.find(({ characterId }) => characterId === request.fromCharacterId)
    const to = attached.find(({ characterId }) => characterId === request.toCharacterId)
    // Unassigning either Character or switching freely deletes the request, so this guards drift.
    if (!from?.active || !to || to.active)
      throw new Error('The request no longer matches the Characters at the table.')
    await switchActiveCharacter(ctx, { campaignId: campaign.id, userId: request.userId, from, to })
    return null
  }
})

export const decline = mutation({
  args: () => zodToConvexFields(campaignActiveCharacterRequestInputSchema.shape),
  returns: () => v.null(),
  handler: async (ctx, args) => {
    const { request } = await requireGmRequest(ctx, args)
    await ctx.db.delete(request._id)
    return null
  }
})

async function requireGmRequest(ctx: MutationCtx, args: unknown) {
  const input = campaignActiveCharacterRequestInputSchema.parse(args)
  const { userId } = await requireIdentity(ctx)
  const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
  if (membership.role !== 'OWNER') rejectDomain('CAMPAIGN_NOT_FOUND')
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  const request = (
    await ctx.db
      .query('campaignActiveCharacterRequests')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
      .collect()
  ).find(({ id }) => id === input.requestId.toLowerCase())
  if (!request) throw new Error('The request was already settled.')
  return { campaign, request }
}

async function toRequestDto(ctx: QueryCtx, request: Doc<'campaignActiveCharacterRequests'>) {
  const label = async (characterId: string) => {
    const character = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', characterId))
      .unique()
    if (!character) throw new Error('Requested Character is unavailable.')
    return character.label
  }
  return campaignActiveCharacterRequestDtoSchema.parse({
    id: request.id,
    campaignId: request.campaignId,
    userId: request.userId,
    fromCharacterId: request.fromCharacterId,
    fromCharacterName: await label(request.fromCharacterId),
    toCharacterId: request.toCharacterId,
    toCharacterName: await label(request.toCharacterId),
    encounterId: request.encounterId,
    requestedAt: request.requestedAt
  })
}
