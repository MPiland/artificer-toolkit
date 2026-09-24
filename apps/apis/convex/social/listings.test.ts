import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type { CreateCampaignInput } from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CreateSocialListingInput,
  SocialEligibilityDto,
  SocialListingDto,
  socialListingPublicIdInputSchema,
  socialListingVersionInputSchema
} from '@artificer-toolkit/schema/api/socialHub'
import { ENTITLEMENT_LIMITS } from '@artificer-toolkit/shared/account/entitlements'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture as characterFixture } from '../../tests/fixtures/characters'
import { api } from '../_generated/api'

const initializeSocial = makeFunctionReference<
  'mutation',
  Record<string, never>,
  SocialEligibilityDto
>('social/profiles:initialize')
const createDraft = makeFunctionReference<
  'mutation',
  { input: CreateSocialListingInput },
  SocialListingDto
>('social/listingDrafts:create')
const openListing = makeFunctionReference<
  'mutation',
  z.input<typeof socialListingVersionInputSchema>,
  SocialListingDto
>('social/listings:open')
const closeListing = makeFunctionReference<
  'mutation',
  z.input<typeof socialListingVersionInputSchema>,
  SocialListingDto
>('social/listings:close')
const getOwned = makeFunctionReference<
  'query',
  z.input<typeof socialListingPublicIdInputSchema>,
  SocialListingDto
>('social/listings:getOwned')

const campaignInput: CreateCampaignInput = {
  name: 'Native Social listing',
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  contentMaturity: 'STANDARD',
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}

function listingInput(
  campaignId: string,
  audience: CreateSocialListingInput['audience'] = 'PUBLIC'
): CreateSocialListingInput {
  return {
    campaignId,
    summary: 'A focused table',
    audience,
    systemId: srdSystemRecord.id,
    playMode: 'ONLINE',
    capacity: 1,
    schedule: { kind: 'FLEXIBLE', timeZone: 'America/Chicago', summary: 'Flexible' },
    location: null,
    expectations: {
      contentGuidance: 'Adventure',
      attendancePolicy: 'Tell us',
      allowedContentRules: 'SRD',
      tableConduct: 'Be kind',
      contentBoundaries: 'Discuss together',
      safetyPractices: ['LINES_AND_VEILS'],
      safetyDetails: 'Pause when needed'
    }
  }
}

async function setup() {
  const base = await characterFixture()
  await base.owner.caller.mutation(api.account.updateProfile, {
    username: 'ListingOwner',
    bio: null
  })
  await base.other.caller.mutation(api.account.updateProfile, {
    username: 'ListingPlayer',
    bio: null
  })
  await base.owner.caller.mutation(initializeSocial, {})
  await base.other.caller.mutation(initializeSocial, {})
  const campaign = await base.owner.caller.mutation(api.campaigns.create.create, campaignInput)
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  return { ...base, campaign }
}

async function draft(
  base: Awaited<ReturnType<typeof setup>>,
  audience: CreateSocialListingInput['audience'] = 'PUBLIC',
  capacity = 1
) {
  return base.owner.caller.mutation(createDraft, {
    input: { ...listingInput(base.campaign.id, audience), capacity }
  })
}

describe('native Social listing lifecycle', () => {
  it('opens, privately reads, closes, preserves publishedAt, and rejects stale/reopen transitions', async () => {
    const base = await setup()
    const created = await draft(base)
    const opened = await base.owner.caller.mutation(openListing, {
      listingPublicId: created.listingPublicId,
      expectedVersion: created.version
    })
    expect(opened).toMatchObject({ status: 'OPEN', version: 1, publishedAt: expect.any(String) })
    const firstPublishedAt = opened.publishedAt
    const privateRead = await base.owner.caller.query(getOwned, {
      listingPublicId: created.listingPublicId
    })
    expect(privateRead).toMatchObject({ status: 'OPEN', version: 1, publishedAt: firstPublishedAt })
    for (const secret of ['campaignId', 'ownerUserId', 'userId', 'email', 'memberships'])
      expect(privateRead).not.toHaveProperty(secret)
    await expect(
      base.owner.caller.mutation(openListing, {
        listingPublicId: created.listingPublicId,
        expectedVersion: created.version
      })
    ).rejects.toThrow()
    const closed = await base.owner.caller.mutation(closeListing, {
      listingPublicId: created.listingPublicId,
      expectedVersion: opened.version
    })
    expect(closed).toMatchObject({ status: 'CLOSED', version: 2, publishedAt: firstPublishedAt })
    await expect(
      base.owner.caller.mutation(closeListing, {
        listingPublicId: created.listingPublicId,
        expectedVersion: opened.version
      })
    ).rejects.toThrow()
    await expect(
      base.owner.caller.mutation(openListing, {
        listingPublicId: created.listingPublicId,
        expectedVersion: closed.version
      })
    ).rejects.toThrow()
  })

  it('enforces owner identity, visible moderation and an active Campaign atomically', async () => {
    const base = await setup()
    const created = await draft(base)
    await expect(
      base.other.caller.mutation(openListing, {
        listingPublicId: created.listingPublicId,
        expectedVersion: 0
      })
    ).rejects.toThrow()
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('socialListings')
        .withIndex('by_publicId', (q) => q.eq('id', created.listingPublicId))
        .unique()
      if (!row) throw new Error('Missing listing.')
      await ctx.db.patch(row._id, { moderationStatus: 'HIDDEN' })
    })
    const hiddenBefore = await base.t.run((ctx) => ctx.db.query('socialListings').collect())
    await expect(
      base.owner.caller.mutation(openListing, {
        listingPublicId: created.listingPublicId,
        expectedVersion: 0
      })
    ).rejects.toThrow()
    expect(await base.t.run((ctx) => ctx.db.query('socialListings').collect())).toEqual(
      hiddenBefore
    )
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('socialListings')
        .withIndex('by_publicId', (q) => q.eq('id', created.listingPublicId))
        .unique()
      if (!row) throw new Error('Missing listing.')
      await ctx.db.patch(row._id, { moderationStatus: 'VISIBLE' })
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique()
      if (!campaign) throw new Error('Missing Campaign.')
      await ctx.db.patch(campaign._id, { status: 'ARCHIVED' })
    })
    const archivedBefore = await base.t.run((ctx) => ctx.db.query('socialListings').collect())
    await expect(
      base.owner.caller.mutation(openListing, {
        listingPublicId: created.listingPublicId,
        expectedVersion: 0
      })
    ).rejects.toThrow()
    expect(await base.t.run((ctx) => ctx.db.query('socialListings').collect())).toEqual(
      archivedBefore
    )
  })

  it('denies suspended owners and outsiders while retaining the owner read after close/archive', async () => {
    const base = await setup()
    const created = await draft(base)
    await base.owner.caller.mutation(openListing, {
      listingPublicId: created.listingPublicId,
      expectedVersion: 0
    })
    await expect(
      base.other.caller.query(getOwned, { listingPublicId: created.listingPublicId })
    ).rejects.toThrow()
    await expect(
      base.t.query(getOwned, { listingPublicId: created.listingPublicId })
    ).rejects.toThrow()
    await expect(
      base.t.mutation(openListing, {
        listingPublicId: created.listingPublicId,
        expectedVersion: 0
      })
    ).rejects.toThrow()
    await expect(
      base.t.mutation(closeListing, {
        listingPublicId: created.listingPublicId,
        expectedVersion: 0
      })
    ).rejects.toThrow()
    await base.t.run(async (ctx) => {
      const profile = await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique()
      if (!profile) throw new Error('Missing owner profile.')
      await ctx.db.patch(profile._id, { status: 'SUSPENDED' })
    })
    await expect(
      base.owner.caller.mutation(closeListing, {
        listingPublicId: created.listingPublicId,
        expectedVersion: 1
      })
    ).rejects.toThrow()
    await expect(
      base.owner.caller.query(getOwned, { listingPublicId: created.listingPublicId })
    ).rejects.toThrow()
    await base.t.run(async (ctx) => {
      const profile = await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique()
      if (!profile) throw new Error('Missing owner profile.')
      await ctx.db.patch(profile._id, { status: 'ACTIVE' })
    })
    await base.owner.caller.mutation(closeListing, {
      listingPublicId: created.listingPublicId,
      expectedVersion: 1
    })
    await base.t.run(async (ctx) => {
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique()
      if (!campaign) throw new Error('Missing Campaign.')
      await ctx.db.patch(campaign._id, { status: 'ARCHIVED' })
    })
    await expect(
      base.owner.caller.query(getOwned, { listingPublicId: created.listingPublicId })
    ).resolves.toMatchObject({
      status: 'CLOSED'
    })
  })

  it.each(['CLOSE', 'ARCHIVE'] as const)(
    'counts hidden PUBLIC listings, exempts PRIVATE and releases a slot after %s',
    async (operation) => {
      const base = await setup()
      await base.t.run((ctx) =>
        ctx.db.insert('accountEntitlements', { userId: base.owner.userId, tier: 'PRO_GM' })
      )
      const first = await draft(base)
      const secondCampaign = await base.owner.caller.mutation(api.campaigns.create.create, {
        ...campaignInput,
        name: 'Second PUBLIC Campaign'
      })
      const privateCampaign = await base.owner.caller.mutation(api.campaigns.create.create, {
        ...campaignInput,
        name: 'PRIVATE Campaign'
      })
      const second = await base.owner.caller.mutation(createDraft, {
        input: listingInput(secondCampaign.id)
      })
      const privateDraft = await base.owner.caller.mutation(createDraft, {
        input: listingInput(privateCampaign.id, 'PRIVATE')
      })
      await base.t.run(async (ctx) => {
        const entitlement = await ctx.db
          .query('accountEntitlements')
          .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
          .unique()
        if (!entitlement) throw new Error('Missing entitlement.')
        await ctx.db.patch(entitlement._id, { tier: 'FREE' })
      })
      await base.owner.caller.mutation(openListing, {
        listingPublicId: first.listingPublicId,
        expectedVersion: 0
      })
      await base.t.run(async (ctx) => {
        const listing = await ctx.db
          .query('socialListings')
          .withIndex('by_publicId', (q) => q.eq('id', first.listingPublicId))
          .unique()
        if (!listing) throw new Error('Missing public listing.')
        await ctx.db.patch(listing._id, { moderationStatus: 'HIDDEN' })
      })
      await expect(
        base.owner.caller.mutation(openListing, {
          listingPublicId: second.listingPublicId,
          expectedVersion: 0
        })
      ).rejects.toThrow('public')
      await expect(
        base.owner.caller.mutation(openListing, {
          listingPublicId: privateDraft.listingPublicId,
          expectedVersion: 0
        })
      ).resolves.toMatchObject({ status: 'OPEN' })
      expect(
        (await base.owner.caller.query(api.accountEntitlements.get, {})).usage.publicListings
      ).toBe(1)
      if (operation === 'CLOSE') {
        await base.owner.caller.mutation(closeListing, {
          listingPublicId: first.listingPublicId,
          expectedVersion: 1
        })
      } else {
        await base.owner.caller.mutation(api.campaigns.archive.archive, {
          campaignId: base.campaign.id,
          expectedVersion: base.campaign.version
        })
      }
      expect(
        (await base.owner.caller.query(api.accountEntitlements.get, {})).usage.publicListings
      ).toBe(0)
      await expect(
        base.owner.caller.mutation(openListing, {
          listingPublicId: second.listingPublicId,
          expectedVersion: 0
        })
      ).resolves.toMatchObject({ status: 'OPEN' })
      expect(
        (await base.owner.caller.query(api.accountEntitlements.get, {})).usage.publicListings
      ).toBe(1)
    }
  )

  it('allows one winner in a concurrent PUBLIC entitlement race', async () => {
    const base = await setup()
    await base.t.run(async (ctx) => {
      const existing = await ctx.db
        .query('accountEntitlements')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique()
      if (existing) await ctx.db.patch(existing._id, { tier: 'PRO_GM' })
      else await ctx.db.insert('accountEntitlements', { userId: base.owner.userId, tier: 'PRO_GM' })
    })
    const second = await base.owner.caller.mutation(api.campaigns.create.create, {
      ...campaignInput,
      name: 'Second listing Campaign'
    })
    await base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: second.id,
        userId: base.other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: second.createdAt,
        joinedAt: second.createdAt,
        leftAt: null
      })
    )
    const firstDraft = await draft(base)
    const secondDraft = await base.owner.caller.mutation(createDraft, {
      input: listingInput(second.id)
    })
    await base.t.run(async (ctx) => {
      const entitlement = await ctx.db
        .query('accountEntitlements')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique()
      if (!entitlement) throw new Error('Missing entitlement.')
      await ctx.db.patch(entitlement._id, { tier: 'FREE' })
    })
    const outcomes = await Promise.allSettled([
      base.owner.caller.mutation(openListing, {
        listingPublicId: firstDraft.listingPublicId,
        expectedVersion: 0
      }),
      base.owner.caller.mutation(openListing, {
        listingPublicId: secondDraft.listingPublicId,
        expectedVersion: 0
      })
    ])
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter((result) => result.status === 'rejected')).toHaveLength(1)
  })

  it('rejects opening when live active PLAYER count exceeds capacity without writes', async () => {
    const base = await setup()
    const created = await draft(base)
    await base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: base.campaign.id,
        userId: crypto.randomUUID(),
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: base.campaign.createdAt,
        joinedAt: base.campaign.createdAt,
        leftAt: null
      })
    )
    const before = await base.t.run((ctx) => ctx.db.query('socialListings').collect())
    await expect(
      base.owner.caller.mutation(openListing, {
        listingPublicId: created.listingPublicId,
        expectedVersion: 0
      })
    ).rejects.toThrow('active player count')
    expect(await base.t.run((ctx) => ctx.db.query('socialListings').collect())).toEqual(before)
  })

  it('rejects a PRO_GM-sized draft after downgrade to FREE without writes', async () => {
    const base = await setup()
    await base.t.run((ctx) =>
      ctx.db.insert('accountEntitlements', { userId: base.owner.userId, tier: 'PRO_GM' })
    )
    const created = await draft(base, 'PUBLIC', ENTITLEMENT_LIMITS.FREE.playerSeatsPerCampaign + 1)
    await base.t.run(async (ctx) => {
      const entitlement = await ctx.db
        .query('accountEntitlements')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique()
      if (!entitlement) throw new Error('Missing entitlement.')
      await ctx.db.patch(entitlement._id, { tier: 'FREE' })
    })
    const before = await base.t.run((ctx) => ctx.db.query('socialListings').collect())
    await expect(
      base.owner.caller.mutation(openListing, {
        listingPublicId: created.listingPublicId,
        expectedVersion: 0
      })
    ).rejects.toThrow('seat limit')
    expect(await base.t.run((ctx) => ctx.db.query('socialListings').collect())).toEqual(before)
  })

  it('rolls back both opening and closing when final System projection fails', async () => {
    const base = await setup()
    const created = await draft(base)
    const system = await base.t.run((ctx) =>
      ctx.db
        .query('systems')
        .withIndex('by_publicId', (q) => q.eq('id', srdSystemRecord.id))
        .unique()
    )
    if (!system) throw new Error('Missing System fixture.')
    const beforeOpen = await base.t.run((ctx) => ctx.db.query('socialListings').collect())
    await base.t.run((ctx) => ctx.db.patch(system._id, { checksum: 'invalid' }))
    await expect(
      base.owner.caller.mutation(openListing, {
        listingPublicId: created.listingPublicId,
        expectedVersion: 0
      })
    ).rejects.toThrow('System checksum mismatch')
    expect(await base.t.run((ctx) => ctx.db.query('socialListings').collect())).toEqual(beforeOpen)
    await base.t.run((ctx) => ctx.db.patch(system._id, { checksum: system.checksum }))
    const opened = await base.owner.caller.mutation(openListing, {
      listingPublicId: created.listingPublicId,
      expectedVersion: 0
    })
    const beforeClose = await base.t.run((ctx) => ctx.db.query('socialListings').collect())
    await base.t.run((ctx) => ctx.db.patch(system._id, { checksum: 'invalid' }))
    await expect(
      base.owner.caller.mutation(closeListing, {
        listingPublicId: created.listingPublicId,
        expectedVersion: opened.version
      })
    ).rejects.toThrow('System checksum mismatch')
    expect(await base.t.run((ctx) => ctx.db.query('socialListings').collect())).toEqual(beforeClose)
  })
})
