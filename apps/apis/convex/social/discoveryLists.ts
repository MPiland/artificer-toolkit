import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  socialBrowseInputSchema,
  socialSearchInputSchema,
  type SocialBrowseInput,
  type SocialSearchInput
} from '@artificer-toolkit/schema/api/socialDiscovery'
import {
  socialListingPageSchema,
  type SocialListingPage
} from '@artificer-toolkit/schema/api/socialListingList'
import { socialStoredListingSchema } from '@artificer-toolkit/schema/projections/socialPersistence'
import { resolveListingSuspension } from './profileInvalidation'
import type { QueryCtx } from '../_generated/server'
import { query } from '../lib/queries'
import { presentListing, requireOwnedCampaign } from './listingDocuments'
import { readProfile } from './profiles'
import { hasSocialBlock, presentSocialProfile, requireSocialViewer } from './visibility'

async function discoveryPage(
  ctx: QueryCtx,
  input: SocialBrowseInput | SocialSearchInput
): Promise<SocialListingPage> {
  const viewer = await requireSocialViewer(ctx)
  if ('query' in input) {
    const missing = await ctx.db
      .query('socialListings')
      .withIndex('by_discovery_searchVersion', (q) =>
        q
          .eq('status', 'OPEN')
          .eq('audience', 'PUBLIC')
          .eq('moderationStatus', 'VISIBLE')
          .eq('search.version', undefined)
      )
      .first()
    if (missing) throw new Error('Social search metadata backfill is incomplete.')
  }
  const listings = ctx.db.query('socialListings')
  const candidates =
    'query' in input
      ? listings.withSearchIndex('search_discovery', (q) => {
          let search = q
            .search('search.text', input.query)
            .eq('status', 'OPEN')
            .eq('audience', 'PUBLIC')
            .eq('moderationStatus', 'VISIBLE')
          if (input.systemId) search = search.eq('systemId', input.systemId.toLowerCase())
          if (input.playMode) search = search.eq('playMode', input.playMode)
          if (input.scheduleKind) search = search.eq('schedule.kind', input.scheduleKind)
          if (input.timeZone) search = search.eq('schedule.timeZone', input.timeZone)
          if (input.stateCode) search = search.eq('location.stateCode', input.stateCode)
          return search
        })
      : listings
          .withIndex('by_discovery_publishedAt_id', (q) =>
            q.eq('status', 'OPEN').eq('audience', 'PUBLIC').eq('moderationStatus', 'VISIBLE')
          )
          .order('desc')
  const result = await candidates.paginate({
    ...input.paginationOpts,
    maximumRowsRead: 8,
    maximumBytesRead: 1024 * 1024
  })
  // Search ignores row/byte limits, and reactive endCursor ranges can outgrow numItems.
  // ponytail: enrich at most eight; native clients split larger ranges or restart without a split cursor.
  if ('query' in input && result.page.length > 8) {
    if (!result.splitCursor) throw new Error('Social search page grew too large. Restart search.')
    return socialListingPageSchema.parse({ ...result, page: [], pageStatus: 'SplitRequired' })
  }
  const page = await Promise.all(
    result.page.map(async (row) => {
      if (
        (input.systemId && row.systemId !== input.systemId.toLowerCase()) ||
        (input.playMode && row.playMode !== input.playMode) ||
        (input.scheduleKind && row.schedule.kind !== input.scheduleKind) ||
        (input.timeZone && row.schedule.timeZone !== input.timeZone) ||
        (input.weekday !== undefined &&
          (row.schedule.kind !== 'RECURRING' || row.schedule.weekday !== input.weekday)) ||
        (input.stateCode && row.location?.stateCode !== input.stateCode) ||
        (input.city && row.location?.city.toLowerCase() !== input.city.toLowerCase()) ||
        (input.safetyPractices?.length &&
          !input.safetyPractices.every((practice) =>
            row.expectations.safetyPractices.includes(practice)
          ))
      )
        return null
      const host = (await readProfile(ctx, row.ownerUserId))?.profile
      if (!host || host.status !== 'ACTIVE' || (await hasSocialBlock(ctx, viewer.id, host.id)))
        return null
      const campaign = await requireOwnedCampaign(ctx, row.campaignId, row.ownerUserId)
      if (
        campaign.status !== 'ACTIVE' ||
        (input.format && campaign.format !== input.format) ||
        (input.contentMaturity && campaign.contentMaturity !== input.contentMaturity) ||
        (input.toneTags?.length && !input.toneTags.some((tag) => campaign.toneTags.includes(tag)))
      )
        return null
      const { _id, _creationTime, ...stored } = row
      const resolved = await resolveListingSuspension(ctx, socialStoredListingSchema.parse(stored))
      if (resolved.status !== 'OPEN') return null
      const listing = await presentListing(
        ctx,
        resolved,
        campaign,
        await presentSocialProfile(ctx, host),
        campaign.contentMaturity === 'MATURE' &&
          (viewer.userId === campaign.ownerUserId ||
            (viewer.contentPreference === 'MATURE' && viewer.adultAttestedAt !== null))
      )
      if (
        (input.rulesetCode && listing.system.rulesetCode !== input.rulesetCode) ||
        (input.rulesetVersion && listing.system.rulesetVersion !== input.rulesetVersion) ||
        (input.minimumAvailableSeats !== undefined &&
          listing.availableSeats < input.minimumAvailableSeats)
      )
        return null
      return listing
    })
  )
  // Preserve native order and cursor metadata, including empty pages with more candidates.
  return socialListingPageSchema.parse({
    ...result,
    page: page.filter((listing) => listing !== null)
  })
}

export const browse = query({
  args: zodToConvexFields(socialBrowseInputSchema.shape),
  returns: zodToConvex(socialListingPageSchema),
  handler: (ctx, args) => discoveryPage(ctx, socialBrowseInputSchema.parse(args))
})

export const search = query({
  args: zodToConvexFields(socialSearchInputSchema.shape),
  returns: zodToConvex(socialListingPageSchema),
  handler: (ctx, args) => discoveryPage(ctx, socialSearchInputSchema.parse(args))
})
