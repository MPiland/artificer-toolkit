import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  updateCampaignInputSchema,
  campaignDetailDtoSchema,
  type CampaignDetailDto
} from '@artificer-toolkit/schema/api/campaignCore'
import { campaignStoredRecordSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import { socialStoredListingSchema } from '@artificer-toolkit/schema/projections/socialPersistence'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { syncAccountUsage } from '../lib/accountUsage'
import { requireRulesCatalogueBinding } from '../content/catalogueBinding'
import { reconcileListingAdmission } from '../social/admissionClosure'
import { listingSearch } from '../social/listingDocuments'
import { resolveListingSuspension } from '../social/profileInvalidation'
import { readCampaignDetail, requireCampaignAuthority } from './documents'
import { readSettings, resolvePlaySettingsSources } from './playSettings'
import { validateCampaignUpdateDependencies } from './updateDependencies'

export const update = mutation({
  args: zodToConvexFields(updateCampaignInputSchema.shape),
  returns: zodToConvex(campaignDetailDtoSchema),
  handler: async (ctx, args): Promise<CampaignDetailDto> => {
    const { userId } = await requireIdentity(ctx)
    const { campaignId, expectedVersion, ...changes } = updateCampaignInputSchema.parse(args)
    const { campaign, membership } = await requireCampaignAuthority(ctx, campaignId, userId)
    if (membership.role !== 'OWNER') throw new Error('You cannot perform this Campaign action.')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    if (campaign.version !== expectedVersion)
      throw new Error('Campaign changed before this action completed.')
    let listing = await ctx.db
      .query('socialListings')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
      .unique()
    const storedListingStatus = listing?.status
    if (listing) {
      const { _id, _creationTime, ...stored } = listing
      listing = {
        ...listing,
        ...(await resolveListingSuspension(ctx, socialStoredListingSchema.parse(stored)))
      }
      if (listing.ownerUserId !== userId)
        throw new Error('Stored Social listing ownership mismatch.')
      if (
        (changes.format ?? campaign.format) === 'ONE_SHOT' &&
        listing.status === 'OPEN' &&
        listing.schedule.kind === 'RECURRING'
      )
        throw new Error(
          'Close or reschedule the recurring Social listing before changing this Campaign to One-shot.'
        )
    }
    const { _id, _creationTime, ...stored } = campaign
    const now = new Date(
      Math.max(
        Date.now(),
        Date.parse(campaign.updatedAt) + 1,
        ...(listing ? [Date.parse(listing.updatedAt) + 1] : [])
      )
    ).toISOString()
    const next = campaignStoredRecordSchema.parse({
      ...stored,
      ...changes,
      additionalRulesCatalogueIds: [
        ...(changes.additionalRulesCatalogueIds ?? campaign.additionalRulesCatalogueIds)
      ].sort(),
      version: campaign.version + 1,
      updatedAt: now
    })
    const proposed = { ...campaign, ...next }
    const catalogueChanged =
      next.primaryRulesCatalogueId !== campaign.primaryRulesCatalogueId ||
      JSON.stringify(next.additionalRulesCatalogueIds) !==
        JSON.stringify([...campaign.additionalRulesCatalogueIds].sort())
    const removedSources = new Set<string>()
    if (catalogueChanged) {
      const prior = await requireRulesCatalogueBinding(ctx, {
        systemId: campaign.gameSystemId,
        primaryRulesCatalogueId: campaign.primaryRulesCatalogueId,
        additionalRulesCatalogueIds: campaign.additionalRulesCatalogueIds
      })
      const { settings } = await readSettings(ctx, campaign.id)
      const { sourceIds: nextSources } = await resolvePlaySettingsSources(
        ctx,
        proposed,
        userId,
        settings
      )
      for (const id of prior.sourceIds) {
        if (!nextSources.has(id)) removedSources.add(id)
      }
    }
    await ctx.db.replace(campaign._id, next)
    const attunementChanged = next.attunementSlotOverride !== campaign.attunementSlotOverride
    if (removedSources.size > 0 || attunementChanged)
      await validateCampaignUpdateDependencies(
        ctx,
        proposed,
        userId,
        removedSources,
        attunementChanged
      )
    const material = (['format', 'toneTags', 'toneDetails', 'contentMaturity'] as const).some(
      (key) => JSON.stringify(campaign[key]) !== JSON.stringify(next[key])
    )
    const listingChanged = material || campaign.name !== next.name
    if (listing && (listingChanged || listing.status !== storedListingStatus)) {
      const version = listing.version + (listingChanged ? 1 : 0)
      await ctx.db.patch(listing._id, {
        status: listing.status,
        ownerProfileGeneration: listing.ownerProfileGeneration ?? 0,
        version,
        updatedAt: now,
        search: listingSearch(next.name, listing.summary)
      })
      await syncAccountUsage(ctx, 'publicListings', listing.id)
      await reconcileListingAdmission(ctx, listing, now, material ? null : version)
    }
    return readCampaignDetail(ctx, await requireCampaignAuthority(ctx, campaign.id, userId))
  }
})
