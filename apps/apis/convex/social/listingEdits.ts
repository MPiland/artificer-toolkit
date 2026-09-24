import type {
  SocialListingDto,
  UpdateSocialListingInput
} from '@artificer-toolkit/schema/api/socialHub'
import { socialStoredListingSchema } from '@artificer-toolkit/schema/projections/socialPersistence'
import type { MutationCtx } from '../_generated/server'
import { syncAccountUsage } from '../lib/accountUsage'
import {
  assertListingWrite,
  assertPublicListingCapacity,
  presentListing,
  listingSearch,
  type requireOwnedListing
} from './listingDocuments'
import { reconcileListingAdmission } from './admissionClosure'

export async function saveListingEdit(
  ctx: MutationCtx,
  owned: Awaited<ReturnType<typeof requireOwnedListing>>,
  input: UpdateSocialListingInput,
  host: SocialListingDto['host']
): Promise<SocialListingDto> {
  const { rowId, listing, campaign } = owned
  const { listingPublicId: _listingPublicId, expectedVersion, ...changes } = input
  if (listing.version !== expectedVersion) throw new Error('Social listing version conflict.')
  const tier = await assertListingWrite(ctx, campaign, input.capacity, input.schedule.kind)
  if (listing.status === 'OPEN' && listing.audience === 'PRIVATE' && input.audience === 'PUBLIC')
    await assertPublicListingCapacity(ctx, campaign.ownerUserId, tier)
  const now = new Date(Math.max(Date.now(), Date.parse(listing.updatedAt) + 1)).toISOString()
  const next = socialStoredListingSchema.parse({
    ...listing,
    ...changes,
    search: listingSearch(campaign.name, input.summary),
    status: listing.status === 'CLOSED' ? 'DRAFT' : listing.status,
    version: listing.version + 1,
    updatedAt: now
  })
  const material = (
    ['audience', 'systemId', 'playMode', 'schedule', 'location', 'expectations'] as const
  ).some((key) => JSON.stringify(listing[key]) !== JSON.stringify(next[key]))
  await ctx.db.replace(rowId, next)
  await syncAccountUsage(ctx, 'publicListings', listing.id)
  await reconcileListingAdmission(ctx, listing, now, material ? null : next.version)
  return presentListing(ctx, next, campaign, host, true)
}
