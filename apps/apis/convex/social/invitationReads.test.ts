import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignInviteDto,
  CreateCampaignInviteInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  SocialInvitationPublicIdInput,
  SocialListingInvitationPublicIdInput
} from '@artificer-toolkit/schema/api/socialAdmissionLists'
import { fixture } from '../../tests/fixtures/socialWriters'
import { orderedSocialPair } from './blockInvalidation'

const create = makeFunctionReference<'mutation', CreateCampaignInviteInput, CampaignInviteDto>(
  'social/invitations:create'
)
const getReceived = makeFunctionReference<
  'query',
  SocialInvitationPublicIdInput,
  CampaignInviteDto
>('social/invitationReads:getReceived')
const getForListing = makeFunctionReference<
  'query',
  SocialListingInvitationPublicIdInput,
  CampaignInviteDto
>('social/invitationReads:getForListing')

async function sourceFixture() {
  const base = await fixture()
  const expiresAt = new Date(Date.now() + 60_000).toISOString()
  const invitation = await base.owner.caller.mutation(create, {
    listingPublicId: base.listing.listingPublicId,
    expectedListingVersion: base.listing.version,
    username: 'AdmissionPlayer',
    expiresAt
  })
  return { ...base, invitation, expiresAt }
}

describe('native invitation deep links', () => {
  it('limits recipient and owner reads, normalizes IDs, and masks Standard text', async () => {
    const base = await sourceFixture()
    const outsider = await base.addActor('InvitationOutsider')
    const input = {
      invitePublicId: base.invitation.invitePublicId.toUpperCase(),
      asOf: new Date(Date.parse(base.expiresAt) - 1).toISOString()
    }
    const ownerInput = { ...input, listingPublicId: base.listing.listingPublicId.toUpperCase() }
    const before = await base.snapshot()

    await expect(base.t.query(getReceived, input)).rejects.toThrow('Unauthenticated')
    await expect(base.owner.caller.query(getReceived, input)).rejects.toThrow(
      'Social invitation not found.'
    )
    await expect(outsider.caller.query(getReceived, input)).rejects.toThrow(
      'Social invitation not found.'
    )
    expect(await base.other.caller.query(getReceived, input)).toMatchObject({
      ...base.invitation,
      listingTitle: 'A ****storm campaign'
    })
    await expect(outsider.caller.query(getForListing, ownerInput)).rejects.toThrow(
      'Social listing not found.'
    )
    expect(await base.owner.caller.query(getForListing, ownerInput)).toMatchObject({
      ...base.invitation,
      listingTitle: 'A ****storm campaign'
    })
    await expect(
      base.owner.caller.query(getForListing, {
        ...ownerInput,
        listingPublicId: crypto.randomUUID()
      })
    ).rejects.toThrow('Social listing not found.')
    expect(await base.snapshot()).toEqual(before)
  })

  it('rejects wrong owned listing and stale owner membership without changing stored data', async () => {
    const base = await sourceFixture()
    const alternateListingId = crypto.randomUUID()
    await base.t.run(async (ctx) => {
      const listing = await ctx.db
        .query('socialListings')
        .withIndex('by_publicId', (q) => q.eq('id', base.listing.listingPublicId))
        .unique()
      if (!listing) throw new Error('Missing listing.')
      const { _id, _creationTime, ...stored } = listing
      await ctx.db.insert('socialListings', { ...stored, id: alternateListingId })
    })
    const alternateInput = {
      listingPublicId: alternateListingId,
      invitePublicId: base.invitation.invitePublicId,
      asOf: base.expiresAt
    }
    const afterAlternate = await base.snapshot()
    await expect(base.owner.caller.query(getForListing, alternateInput)).rejects.toThrow(
      'Social invitation not found.'
    )
    expect(await base.snapshot()).toEqual(afterAlternate)
    await base.t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('userId', base.owner.userId)
        )
        .unique()
      if (!membership) throw new Error('Missing owner membership.')
      await ctx.db.patch(membership._id, { status: 'LEFT' })
    })
    const afterMembership = await base.snapshot()
    await expect(
      base.owner.caller.query(getForListing, {
        ...alternateInput,
        listingPublicId: base.listing.listingPublicId
      })
    ).rejects.toThrow('Campaign not found.')
    expect(await base.snapshot()).toEqual(afterMembership)
  })

  it('projects exact-horizon expiry, preserves retained block invalidation precedence, and requires active profiles', async () => {
    const base = await sourceFixture()
    const input = { invitePublicId: base.invitation.invitePublicId, asOf: base.expiresAt }
    const before = await base.snapshot()
    expect(await base.other.caller.query(getReceived, input)).toMatchObject({
      status: 'EXPIRED',
      version: base.invitation.version
    })
    expect(await base.snapshot()).toEqual(before)
    const { host, recipient } = await base.t.run(async (ctx) => {
      const [host, recipient] = await Promise.all([
        ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
          .unique(),
        ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
          .unique()
      ])
      if (!host || !recipient) throw new Error('Missing Social profiles.')
      await ctx.db.insert('socialBlockInvalidations', {
        ...orderedSocialPair(host, recipient),
        generation: 1,
        invalidatedAt: base.expiresAt
      })
      return { host, recipient }
    })
    const retained = await base.snapshot()
    expect(await base.other.caller.query(getReceived, input)).toMatchObject({
      status: 'REVOKED',
      version: base.invitation.version + 1
    })
    expect(await base.snapshot()).toEqual(retained)
    const blockId = await base.t.run((ctx) =>
      ctx.db.insert('socialBlocks', {
        blockerProfileId: host.id,
        blockedProfileId: recipient.id,
        createdAt: base.expiresAt
      })
    )
    await expect(base.other.caller.query(getReceived, input)).rejects.toThrow(
      'Social admission is unavailable.'
    )
    await base.t.run(async (ctx) => {
      await ctx.db.delete(blockId)
      await ctx.db.patch(recipient._id, { status: 'SUSPENDED' })
    })
    await expect(base.other.caller.query(getReceived, input)).rejects.toThrow(
      'An active Social profile is required.'
    )
  })
})
