import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type {
  SocialEligibilityDto,
  SocialListingDto,
  SocialProfileDto,
  socialListingPublicIdInputSchema,
  socialProfilePublicIdInputSchema,
  updateSocialContentPreferenceInputSchema
} from '@artificer-toolkit/schema/api/socialHub'
import { socialStoredBlockSchema } from '@artificer-toolkit/schema/projections/socialPersistence'
import { fixture as setup } from '../../tests/fixtures/socialAdmission'
import { api } from '../_generated/api'

const getProfile = makeFunctionReference<
  'query',
  z.input<typeof socialProfilePublicIdInputSchema>,
  SocialProfileDto
>('social/discovery:getProfile')
const getListing = makeFunctionReference<
  'query',
  z.input<typeof socialListingPublicIdInputSchema>,
  SocialListingDto
>('social/discovery:getListing')
const getOwnedListing = makeFunctionReference<
  'query',
  z.input<typeof socialListingPublicIdInputSchema>,
  SocialListingDto
>('social/listings:getOwned')
const updatePreference = makeFunctionReference<
  'mutation',
  { input: z.input<typeof updateSocialContentPreferenceInputSchema> },
  SocialEligibilityDto
>('social/profiles:updatePreference')

const profileKeys = ['profilePublicId', 'username'].sort()
const listingKeys = [
  'listingPublicId',
  'host',
  'title',
  'summary',
  'status',
  'audience',
  'moderationStatus',
  'system',
  'format',
  'toneTags',
  'toneDetails',
  'contentMaturity',
  'playMode',
  'capacity',
  'availableSeats',
  'ageBand',
  'schedule',
  'location',
  'expectations',
  'isFree',
  'publishedAt',
  'version'
].sort()

async function profileIds(base: Awaited<ReturnType<typeof setup>>) {
  return base.t.run(async (ctx) => {
    const owner = await ctx.db
      .query('socialProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
      .unique()
    const other = await ctx.db
      .query('socialProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
      .unique()
    if (!owner || !other) throw new Error('Missing Social profiles.')
    return { owner: owner.id, other: other.id }
  })
}

async function poisonText(
  base: Awaited<ReturnType<typeof setup>>,
  maturity: 'STANDARD' | 'MATURE'
) {
  await base.t.run(async (ctx) => {
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    const listing = await ctx.db
      .query('socialListings')
      .withIndex('by_publicId', (q) => q.eq('id', base.listingId))
      .unique()
    if (!campaign || !listing) throw new Error('Missing discovery fixture.')
    await ctx.db.patch(campaign._id, {
      contentMaturity: maturity,
      name: 'shit campaign',
      toneDetails: 'shit tone'
    })
    await ctx.db.patch(listing._id, {
      summary: 'shit summary',
      schedule: { ...listing.schedule, summary: 'shit schedule' },
      expectations: {
        ...listing.expectations,
        contentGuidance: 'shit guidance',
        attendancePolicy: 'shit attendance',
        allowedContentRules: 'shit rules',
        tableConduct: 'shit conduct',
        contentBoundaries: 'shit boundaries',
        safetyDetails: 'shit safety'
      }
    })
  })
}

describe('native Social discovery reads', () => {
  it('requires an active viewer and returns strict public profile/listing projections with live seats', async () => {
    const base = await setup()
    const ids = await profileIds(base)
    const profile = await base.other.caller.query(getProfile, {
      profilePublicId: ids.owner.toUpperCase()
    })
    expect(Object.keys(profile).sort()).toEqual(profileKeys)
    expect(profile).toMatchObject({ profilePublicId: ids.owner, username: 'TransferOwner' })
    await base.owner.caller.mutation(api.account.updateProfile, {
      username: 'RenamedHost',
      bio: 'Private bio'
    })
    await expect(
      base.other.caller.query(getProfile, { profilePublicId: ids.owner })
    ).resolves.toEqual({
      profilePublicId: ids.owner,
      username: 'RenamedHost'
    })
    await poisonText(base, 'STANDARD')
    const memberships = await base.t.run((ctx) => ctx.db.query('campaignMemberships').collect())
    const listing = await base.other.caller.query(getListing, {
      listingPublicId: base.listingId.toUpperCase()
    })
    expect(Object.keys(listing).sort()).toEqual(listingKeys)
    expect(listing).toMatchObject({
      listingPublicId: base.listingId,
      title: '**** campaign',
      summary: '**** summary',
      toneDetails: '**** tone',
      host: { profilePublicId: ids.owner, username: 'RenamedHost' },
      availableSeats: 3,
      schedule: { summary: '**** schedule' },
      expectations: {
        contentGuidance: '**** guidance',
        attendancePolicy: '**** attendance',
        allowedContentRules: '**** rules',
        tableConduct: '**** conduct',
        contentBoundaries: '**** boundaries',
        safetyDetails: '**** safety'
      }
    })
    expect(await base.owner.caller.query(getListing, { listingPublicId: base.listingId })).toEqual(
      listing
    )
    const privateEdit = await base.owner.caller.query(getOwnedListing, {
      listingPublicId: base.listingId
    })
    expect(privateEdit).toMatchObject({
      title: 'shit campaign',
      summary: 'shit summary',
      toneDetails: 'shit tone',
      schedule: { summary: 'shit schedule' },
      expectations: { safetyDetails: 'shit safety' }
    })
    expect(await base.t.run((ctx) => ctx.db.query('campaignMemberships').collect())).toEqual(
      memberships
    )
    for (const secret of ['campaignId', 'ownerUserId', 'userId', 'email', 'memberships', 'bio']) {
      expect(listing).not.toHaveProperty(secret)
      expect(listing.host).not.toHaveProperty(secret)
    }
    await expect(
      base.t.query(getProfile, { profilePublicId: crypto.randomUUID() })
    ).rejects.toThrow()
    await expect(
      base.t.query(getListing, { listingPublicId: crypto.randomUUID() })
    ).rejects.toThrow()
    await expect(
      base.other.caller.query(getProfile, { profilePublicId: crypto.randomUUID() })
    ).rejects.toThrow('not found')
    await expect(
      base.other.caller.query(getListing, { listingPublicId: crypto.randomUUID() })
    ).rejects.toThrow('not found')
  })

  it('applies symmetric directional blocks to profile and listing discovery', async () => {
    const base = await setup()
    const ids = await profileIds(base)
    const memberships = await base.t.run((ctx) => ctx.db.query('campaignMemberships').collect())
    for (const [blockerProfileId, blockedProfileId] of [
      [ids.owner, ids.other],
      [ids.other, ids.owner]
    ] as const) {
      await base.t.run((ctx) =>
        ctx.db.insert(
          'socialBlocks',
          socialStoredBlockSchema.parse({
            blockerProfileId,
            blockedProfileId,
            createdAt: base.campaign.createdAt
          })
        )
      )
      await expect(
        base.owner.caller.query(getProfile, { profilePublicId: ids.other })
      ).rejects.toThrow()
      await expect(
        base.other.caller.query(getProfile, { profilePublicId: ids.owner })
      ).rejects.toThrow()
      await expect(
        base.other.caller.query(getListing, { listingPublicId: base.listingId })
      ).rejects.toThrow()
      await base.t.run(async (ctx) => {
        const rows = await ctx.db.query('socialBlocks').collect()
        for (const row of rows) await ctx.db.delete(row._id)
      })
      await expect(
        base.other.caller.query(getProfile, { profilePublicId: ids.owner })
      ).resolves.toMatchObject({ profilePublicId: ids.owner })
      await expect(
        base.other.caller.query(getListing, { listingPublicId: base.listingId })
      ).resolves.toMatchObject({ listingPublicId: base.listingId })
    }
    expect(await base.t.run((ctx) => ctx.db.query('campaignMemberships').collect())).toEqual(
      memberships
    )
  })

  it('preserves MATURE text for the owner or adult-attested MATURE viewer and fails closed on corrupt preference', async () => {
    const base = await setup()
    const ids = await profileIds(base)
    await poisonText(base, 'MATURE')
    const ownerView = await base.owner.caller.query(getListing, { listingPublicId: base.listingId })
    expect(ownerView).toMatchObject({ title: 'shit campaign', summary: 'shit summary' })
    const masked = await base.other.caller.query(getListing, { listingPublicId: base.listingId })
    expect(masked).toMatchObject({ title: '**** campaign', summary: '**** summary' })
    await base.other.caller.mutation(updatePreference, {
      input: { contentPreference: 'MATURE', birthDate: '1900-01-01' }
    })
    const matureView = await base.other.caller.query(getListing, {
      listingPublicId: base.listingId
    })
    expect(matureView).toMatchObject({ title: 'shit campaign', summary: 'shit summary' })
    await base.other.caller.mutation(updatePreference, { input: { contentPreference: 'STANDARD' } })
    await expect(
      base.other.caller.query(getListing, { listingPublicId: base.listingId })
    ).resolves.toMatchObject({ title: '**** campaign' })
    await base.t.run(async (ctx) => {
      const profile = await ctx.db
        .query('socialProfiles')
        .withIndex('by_publicId', (q) => q.eq('id', ids.other))
        .unique()
      if (!profile) throw new Error('Missing Social profile.')
      await ctx.db.patch(profile._id, { contentPreference: 'MATURE', adultAttestedAt: null })
    })
    await expect(
      base.other.caller.query(getListing, { listingPublicId: base.listingId })
    ).rejects.toThrow()
  })

  it('allows only the host to read private, draft, closed, hidden and archived listings', async () => {
    const base = await setup()
    const states = [
      { status: 'OPEN' as const, audience: 'PRIVATE' as const },
      { status: 'DRAFT' as const, audience: 'PUBLIC' as const },
      { status: 'CLOSED' as const, audience: 'PUBLIC' as const },
      { status: 'OPEN' as const, audience: 'PUBLIC' as const, moderationStatus: 'HIDDEN' as const }
    ]
    for (const state of states) {
      await base.t.run(async (ctx) => {
        const listing = await ctx.db
          .query('socialListings')
          .withIndex('by_publicId', (q) => q.eq('id', base.listingId))
          .unique()
        if (!listing) throw new Error('Missing listing.')
        await ctx.db.patch(listing._id, state)
      })
      await expect(
        base.owner.caller.query(getListing, { listingPublicId: base.listingId })
      ).resolves.toMatchObject({ status: state.status, audience: state.audience })
      await expect(
        base.other.caller.query(getListing, { listingPublicId: base.listingId })
      ).rejects.toThrow()
    }
    await base.t.run(async (ctx) => {
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique()
      if (!campaign) throw new Error('Missing Campaign.')
      await ctx.db.patch(campaign._id, { status: 'ARCHIVED' })
      const listing = await ctx.db
        .query('socialListings')
        .withIndex('by_publicId', (q) => q.eq('id', base.listingId))
        .unique()
      if (!listing) throw new Error('Missing listing.')
      await ctx.db.patch(listing._id, {
        status: 'OPEN',
        audience: 'PUBLIC',
        moderationStatus: 'VISIBLE'
      })
    })
    await expect(
      base.owner.caller.query(getListing, { listingPublicId: base.listingId })
    ).resolves.toMatchObject({ status: 'OPEN' })
    await expect(
      base.other.caller.query(getListing, { listingPublicId: base.listingId })
    ).rejects.toThrow('not found')
  })

  it.each(['missing', 'suspended'] as const)(
    'rejects %s viewer eligibility on both shared endpoints',
    async (state) => {
      const base = await setup()
      const ids = await profileIds(base)
      await base.t.run(async (ctx) => {
        const profile = await ctx.db
          .query('socialProfiles')
          .withIndex('by_publicId', (q) => q.eq('id', ids.other))
          .unique()
        if (!profile) throw new Error('Missing viewer.')
        if (state === 'missing') await ctx.db.delete(profile._id)
        else await ctx.db.patch(profile._id, { status: 'SUSPENDED' })
      })
      await expect(
        base.other.caller.query(getProfile, { profilePublicId: ids.owner })
      ).rejects.toThrow('active Social profile')
      await expect(
        base.other.caller.query(getListing, { listingPublicId: base.listingId })
      ).rejects.toThrow('active Social profile')
    }
  )

  it.each(['suspended', 'missing-account'] as const)(
    'hides the %s host on both shared endpoints',
    async (state) => {
      const base = await setup()
      const ids = await profileIds(base)
      await base.t.run(async (ctx) => {
        if (state === 'suspended') {
          const profile = await ctx.db
            .query('socialProfiles')
            .withIndex('by_publicId', (q) => q.eq('id', ids.owner))
            .unique()
          if (!profile) throw new Error('Missing host.')
          await ctx.db.patch(profile._id, { status: 'SUSPENDED' })
        } else {
          const account = await ctx.db
            .query('userProfiles')
            .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
            .unique()
          if (!account) throw new Error('Missing host account.')
          await ctx.db.delete(account._id)
        }
      })
      await expect(
        base.other.caller.query(getProfile, { profilePublicId: ids.owner })
      ).rejects.toThrow('not found')
      await expect(
        base.other.caller.query(getListing, { listingPublicId: base.listingId })
      ).rejects.toThrow('not found')
    }
  )

  it('fails closed for ownership drift and missing host profile', async () => {
    const base = await setup()
    await base.t.run(async (ctx) => {
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique()
      if (!campaign) throw new Error('Missing Campaign.')
      await ctx.db.patch(campaign._id, { ownerUserId: base.other.userId })
    })
    await expect(
      base.other.caller.query(getListing, { listingPublicId: base.listingId })
    ).rejects.toThrow()
    const missing = await setup()
    await missing.t.run(async (ctx) => {
      const profile = await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', missing.owner.userId))
        .unique()
      if (!profile) throw new Error('Missing host profile.')
      await ctx.db.delete(profile._id)
    })
    await expect(
      missing.other.caller.query(getListing, { listingPublicId: missing.listingId })
    ).rejects.toThrow()
  })
})
