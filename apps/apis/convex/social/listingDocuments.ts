import {
  socialListingDtoSchema,
  type SocialListingDto
} from '@artificer-toolkit/schema/api/socialHub'
import {
  socialStoredListingSchema,
  type SocialStoredListing
} from '@artificer-toolkit/schema/projections/socialPersistence'
import { ENTITLEMENT_LIMITS } from '@artificer-toolkit/shared/account/entitlements'
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'
import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { getAuthenticatedProfile } from '../lib/identity'
import { readActiveCampaignMembers, requireCampaignAuthority } from '../campaigns/authority'
import { requireSystem } from '../content/systemDocuments'
import { readProfile } from './profiles'
import { resolveListingSuspension } from './profileInvalidation'

export function listingSearch(name: string, summary: string) {
  return { version: 1 as const, text: `${name} ${summary}` }
}

export async function requireSocialOwner(ctx: QueryCtx) {
  const account = await getAuthenticatedProfile(ctx)
  if (!account) throw new Error('Unauthenticated')
  const social = await readProfile(ctx, account.identity.userId)
  if (!social || social.profile.status !== 'ACTIVE')
    throw new Error('An active Social profile is required.')
  if (!account.username) throw new Error('A username is required.')
  return {
    userId: account.identity.userId,
    invalidationGeneration: social.profile.invalidationGeneration ?? 0,
    host: { profilePublicId: social.profile.id, username: account.username }
  }
}

export async function requireOwnedCampaign(ctx: QueryCtx, campaignId: string, userId: string) {
  const { campaign, membership } = await requireCampaignAuthority(ctx, campaignId, userId)
  if (membership.role !== 'OWNER') throw new Error('Social listing not found.')
  return campaign
}

export async function requireOwnedListing(ctx: QueryCtx, id: string, userId: string) {
  const row = await ctx.db
    .query('socialListings')
    .withIndex('by_publicId', (q) => q.eq('id', id.toLowerCase()))
    .unique()
  if (!row || row.ownerUserId !== userId) throw new Error('Social listing not found.')
  const campaign = await requireOwnedCampaign(ctx, row.campaignId, userId)
  const { _id, _creationTime, ...stored } = row
  const listing = await resolveListingSuspension(ctx, socialStoredListingSchema.parse(stored))
  return { rowId: _id, listing, campaign }
}

export async function presentListing(
  ctx: QueryCtx,
  listing: SocialStoredListing,
  campaign: Doc<'campaigns'>,
  host: SocialListingDto['host'],
  originalText: boolean
): Promise<SocialListingDto> {
  const [system, members] = await Promise.all([
    requireSystem(ctx, listing.systemId),
    readActiveCampaignMembers(ctx, campaign)
  ])
  // Authorization is the caller's responsibility; shared Standard reads must pass false, even for owners.
  const present = (value: string) =>
    originalText ? value : presentCampaignPlainText(value, 'STANDARD')
  return socialListingDtoSchema.parse({
    listingPublicId: listing.id,
    host,
    title: present(campaign.name),
    summary: present(listing.summary),
    status: listing.status,
    audience: listing.audience,
    moderationStatus: listing.moderationStatus,
    system: {
      systemId: system.id,
      label: system.label,
      rulesetCode: system.rulesetCode,
      rulesetVersion: system.rulesetVersion
    },
    format: campaign.format,
    toneTags: campaign.toneTags,
    toneDetails: campaign.toneDetails === null ? null : present(campaign.toneDetails),
    contentMaturity: campaign.contentMaturity,
    playMode: listing.playMode,
    capacity: listing.capacity,
    availableSeats: Math.max(
      0,
      listing.capacity - members.filter((member) => member.role === 'PLAYER').length
    ),
    ageBand: '13_PLUS',
    schedule: {
      ...listing.schedule,
      summary: present(listing.schedule.summary)
    },
    location: listing.location,
    expectations: {
      ...listing.expectations,
      contentGuidance: present(listing.expectations.contentGuidance),
      attendancePolicy: present(listing.expectations.attendancePolicy),
      allowedContentRules: present(listing.expectations.allowedContentRules),
      tableConduct: present(listing.expectations.tableConduct),
      contentBoundaries: present(listing.expectations.contentBoundaries),
      safetyDetails: present(listing.expectations.safetyDetails)
    },
    isFree: true,
    publishedAt: listing.publishedAt,
    version: listing.version
  })
}

export async function assertListingWrite(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  capacity: number,
  scheduleKind: SocialListingDto['schedule']['kind']
) {
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns cannot be listed.')
  if (campaign.format === 'ONE_SHOT' && scheduleKind === 'RECURRING')
    throw new Error('One-shot Campaigns cannot use a recurring schedule.')
  const [entitlement, members] = await Promise.all([
    ctx.db
      .query('accountEntitlements')
      .withIndex('by_userId', (q) => q.eq('userId', campaign.ownerUserId))
      .unique(),
    readActiveCampaignMembers(ctx, campaign)
  ])
  if (capacity < members.filter((member) => member.role === 'PLAYER').length)
    throw new Error('Capacity cannot be lower than the active player count.')
  if (capacity > ENTITLEMENT_LIMITS[entitlement?.tier ?? 'FREE'].playerSeatsPerCampaign)
    throw new Error('Capacity exceeds your account player seat limit.')
  return entitlement?.tier ?? 'FREE'
}

export async function assertPublicListingCapacity(
  ctx: QueryCtx,
  userId: string,
  tier: keyof typeof ENTITLEMENT_LIMITS
) {
  const limit = ENTITLEMENT_LIMITS[tier].publicListings
  if (limit === null) return
  const generation = (await readProfile(ctx, userId))?.profile.invalidationGeneration ?? 0
  // Suspended generations are logically CLOSED even while their physical cleanup is pending.
  const active = await ctx.db
    .query('socialListings')
    .withIndex('by_ownerUserId_ownerProfileGeneration_audience_status', (q) =>
      q
        .eq('ownerUserId', userId)
        .eq('ownerProfileGeneration', generation)
        .eq('audience', 'PUBLIC')
        .eq('status', 'OPEN')
    )
    .take(limit)
  const legacy =
    generation === 0 && active.length < limit
      ? await ctx.db
          .query('socialListings')
          .withIndex('by_ownerUserId_ownerProfileGeneration_audience_status', (q) =>
            q
              .eq('ownerUserId', userId)
              .eq('ownerProfileGeneration', undefined)
              .eq('audience', 'PUBLIC')
              .eq('status', 'OPEN')
          )
          .take(limit - active.length)
      : []
  if (active.length + legacy.length >= limit)
    throw new Error('Your account has reached its publicListings limit.')
}
