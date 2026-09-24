import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { z } from 'zod'
import {
  createCampaignInputSchema,
  campaignIdInputSchema,
  campaignDetailDtoSchema,
  type CampaignDetailDto
} from '@artificer-toolkit/schema/api/campaignCore'
import { campaignPlaySettingsDtoSchema } from '@artificer-toolkit/schema/api/campaignSettings'
import { campaignStoredRecordSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import { ENTITLEMENT_LIMITS } from '@artificer-toolkit/shared/account/entitlements'
import { type MutationCtx } from '../_generated/server'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { syncAccountUsage } from '../lib/accountUsage'
import { ensureAuthoredRouteId } from '../content/routeIds'
import { requireRulesCatalogueBinding } from '../content/catalogueBinding'
import { readCampaignDetail, requireCampaignAuthority } from './documents'

export async function createCampaignForOwner(
  ctx: MutationCtx,
  userId: string,
  input: z.output<typeof createCampaignInputSchema>,
  attunementSlotOverride: CampaignDetailDto['attunementSlotOverride'] = null,
  destinationId?: string
): Promise<CampaignDetailDto> {
  const entitlement = await ctx.db
    .query('accountEntitlements')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique()
  const limit = ENTITLEMENT_LIMITS[entitlement?.tier ?? 'FREE'].activeHostedCampaigns
  if (limit !== null) {
    const owned = await ctx.db
      .query('campaigns')
      .withIndex('by_ownerUserId_status', (q) => q.eq('ownerUserId', userId).eq('status', 'ACTIVE'))
      .take(limit)
    if (owned.length >= limit)
      throw new Error('Your account has reached its activeHostedCampaigns limit.')
  }
  await requireRulesCatalogueBinding(ctx, {
    systemId: input.gameSystemId,
    primaryRulesCatalogueId: input.primaryRulesCatalogueId,
    additionalRulesCatalogueIds: input.additionalRulesCatalogueIds
  })
  const id = campaignIdInputSchema.parse({
    campaignId: destinationId ?? crypto.randomUUID()
  }).campaignId
  const existing = await ctx.db
    .query('campaigns')
    .withIndex('by_publicId', (q) => q.eq('id', id))
    .unique()
  if (existing) throw new Error('Campaign destination already exists.')
  const publicId = await ensureAuthoredRouteId(ctx, 'CAMPAIGN', id)
  const now = new Date().toISOString()
  await ctx.db.insert(
    'campaigns',
    campaignStoredRecordSchema.parse({
      ...input,
      id,
      publicId,
      ownerUserId: userId,
      description: input.description ?? null,
      toneDetails: input.toneDetails ?? null,
      additionalRulesCatalogueIds: [...input.additionalRulesCatalogueIds].sort((left, right) =>
        left.localeCompare(right)
      ),
      attunementSlotOverride,
      status: 'ACTIVE',
      version: 0,
      createdAt: now,
      updatedAt: now
    })
  )
  await ctx.db.insert('campaignMemberships', {
    campaignId: id,
    userId,
    role: 'OWNER',
    status: 'ACTIVE',
    accessStartedAt: now,
    joinedAt: now,
    leftAt: null
  })
  await ctx.db.insert(
    'campaignPlaySettings',
    campaignPlaySettingsDtoSchema.parse({
      campaignId: id,
      normalCadenceDays: null,
      expectedDurationMinutes: null,
      quorum: null,
      absentCharacterPolicy: null,
      contentGuidance: null,
      allowedContentRules: null,
      tableConduct: null,
      contentBoundaries: null,
      safetyPractices: [],
      liveSafetyMethod: null,
      version: 0,
      updatedAt: now
    })
  )
  await syncAccountUsage(ctx, 'activeHostedCampaigns', id)
  return readCampaignDetail(ctx, await requireCampaignAuthority(ctx, id, userId))
}

export const create = mutation({
  args: zodToConvexFields(createCampaignInputSchema.shape),
  returns: zodToConvex(campaignDetailDtoSchema),
  handler: async (ctx, args): Promise<CampaignDetailDto> => {
    const { userId } = await requireIdentity(ctx)
    return createCampaignForOwner(ctx, userId, createCampaignInputSchema.parse(args))
  }
})
