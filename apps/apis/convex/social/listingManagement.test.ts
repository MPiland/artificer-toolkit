import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type { CreateCampaignInput } from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CreateSocialListingInput,
  SocialEligibilityDto,
  SocialListingDto,
  UpdateSocialListingInput
} from '@artificer-toolkit/schema/api/socialHub'
import type {
  SocialListingListInput,
  SocialListingPage
} from '@artificer-toolkit/schema/api/socialListingList'
import { socialListingPublicIdInputSchema } from '@artificer-toolkit/schema/api/socialHub'
import { socialListingVersionInputSchema } from '@artificer-toolkit/schema/api/socialHub'
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
const listOwned = makeFunctionReference<'query', SocialListingListInput, SocialListingPage>(
  'social/listings:listOwned'
)
const updateListing = makeFunctionReference<
  'mutation',
  { input: UpdateSocialListingInput },
  SocialListingDto
>('social/listings:update')
const getOwned = makeFunctionReference<
  'query',
  z.input<typeof socialListingPublicIdInputSchema>,
  SocialListingDto
>('social/listings:getOwned')

const campaignInput: CreateCampaignInput = {
  name: 'Listing management',
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  contentMaturity: 'STANDARD',
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}

function listingInput(
  campaignId: string,
  audience: CreateSocialListingInput['audience'] = 'PUBLIC',
  capacity = 1
): CreateSocialListingInput {
  return {
    campaignId,
    summary: 'Original summary',
    audience,
    systemId: srdSystemRecord.id,
    playMode: 'ONLINE',
    capacity,
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

function updateFields(
  campaignId: string,
  audience: CreateSocialListingInput['audience'] = 'PUBLIC',
  capacity = 1
): Omit<CreateSocialListingInput, 'campaignId'> {
  const { campaignId: _campaignId, ...fields } = listingInput(campaignId, audience, capacity)
  return fields
}

async function setup() {
  const base = await characterFixture()
  await base.owner.caller.mutation(api.account.updateProfile, {
    username: 'ManagementOwner',
    bio: null
  })
  await base.other.caller.mutation(api.account.updateProfile, {
    username: 'ManagementPlayer',
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

async function createFor(
  base: Awaited<ReturnType<typeof setup>>,
  campaignId = base.campaign.id,
  audience: CreateSocialListingInput['audience'] = 'PUBLIC',
  capacity = 1
) {
  return base.owner.caller.mutation(createDraft, {
    input: listingInput(campaignId, audience, capacity)
  })
}

async function ownedPage(
  base: Awaited<ReturnType<typeof setup>>,
  cursor: string | null,
  numItems = 3
) {
  return base.owner.caller.query(listOwned, {
    paginationOpts: { cursor, numItems }
  })
}

describe('native Social listing management', () => {
  it('lists every owned status with bounded descending pagination and excludes foreign owners', async () => {
    const base = await setup()
    await base.t.run((ctx) =>
      ctx.db.insert('accountEntitlements', { userId: base.owner.userId, tier: 'PRO_GM' })
    )
    const campaigns = [base.campaign]
    for (let index = 0; index < 8; index++)
      campaigns.push(
        await base.owner.caller.mutation(api.campaigns.create.create, {
          ...campaignInput,
          name: `Owned ${index}`
        })
      )
    const listings = []
    for (const [index, campaign] of campaigns.entries()) {
      const listing = await createFor(base, campaign.id)
      listings.push(listing)
      if (index % 3 === 1)
        await base.owner.caller.mutation(openListing, {
          listingPublicId: listing.listingPublicId,
          expectedVersion: 0
        })
      if (index % 3 === 2) {
        await base.owner.caller.mutation(openListing, {
          listingPublicId: listing.listingPublicId,
          expectedVersion: 0
        })
        await base.owner.caller.mutation(closeListing, {
          listingPublicId: listing.listingPublicId,
          expectedVersion: 1
        })
      }
    }
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique()
      if (!row) throw new Error('Missing Campaign.')
      await ctx.db.patch(row._id, { status: 'ARCHIVED' })
    })
    const foreignCampaign = await base.other.caller.mutation(api.campaigns.create.create, {
      ...campaignInput,
      name: 'Foreign campaign'
    })
    const foreignListing = await base.other.caller.mutation(createDraft, {
      input: listingInput(foreignCampaign.id)
    })
    const seen: string[] = []
    let cursor: string | null = null
    for (let page = 0; page < 5; page++) {
      const result = await ownedPage(base, cursor)
      seen.push(...result.page.map((listing) => listing.listingPublicId))
      if (result.isDone) break
      cursor = result.continueCursor
    }
    expect(seen).toHaveLength(9)
    expect(new Set(seen)).toEqual(new Set(listings.map((listing) => listing.listingPublicId)))
    expect(seen).not.toContain(foreignListing.listingPublicId)
    const expected = await base.t.run(async (ctx) =>
      (await ctx.db.query('socialListings').collect())
        .filter((row) => row.ownerUserId === base.owner.userId)
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || (a.id < b.id ? 1 : -1))
        .map((row) => row.id)
    )
    expect(seen).toEqual(expected)
  })

  it('fails closed when the Campaign owner changes or the owner profile is suspended', async () => {
    const base = await setup()
    const listing = await createFor(base)
    await base.t.run(async (ctx) => {
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique()
      if (!campaign) throw new Error('Missing Campaign.')
      await ctx.db.patch(campaign._id, { ownerUserId: base.other.userId })
    })
    await expect(ownedPage(base, null)).rejects.toThrow()
    await expect(
      base.owner.caller.query(getOwned, { listingPublicId: listing.listingPublicId })
    ).rejects.toThrow()
    const fresh = await setup()
    const freshListing = await createFor(fresh)
    await fresh.t.run(async (ctx) => {
      const profile = await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', fresh.owner.userId))
        .unique()
      if (!profile) throw new Error('Missing Social profile.')
      await ctx.db.patch(profile._id, { status: 'SUSPENDED' })
    })
    await expect(ownedPage(fresh, null)).rejects.toThrow()
    await expect(
      fresh.owner.caller.mutation(updateListing, {
        input: {
          ...updateFields(fresh.campaign.id),
          listingPublicId: freshListing.listingPublicId,
          expectedVersion: 0
        }
      })
    ).rejects.toThrow()
  })

  it('updates DRAFT and OPEN listings and returns edited CLOSED listings to DRAFT while retaining publication history', async () => {
    const base = await setup()
    const draft = await createFor(base)
    const openBase = await setup()
    const open = await createFor(openBase)
    const closedBase = await setup()
    const closed = await createFor(closedBase)
    await openBase.owner.caller.mutation(openListing, {
      listingPublicId: open.listingPublicId,
      expectedVersion: 0
    })
    await closedBase.owner.caller.mutation(openListing, {
      listingPublicId: closed.listingPublicId,
      expectedVersion: 0
    })
    await closedBase.owner.caller.mutation(closeListing, {
      listingPublicId: closed.listingPublicId,
      expectedVersion: 1
    })
    for (const [actor, listing, campaignId, status, expectedVersion] of [
      [base.owner, draft, base.campaign.id, 'DRAFT', 0],
      [openBase.owner, open, openBase.campaign.id, 'OPEN', 1],
      [closedBase.owner, closed, closedBase.campaign.id, 'DRAFT', 2]
    ] as const) {
      const before = await actor.caller.query(getOwned, {
        listingPublicId: listing.listingPublicId
      })
      const updated = await actor.caller.mutation(updateListing, {
        input: {
          ...updateFields(campaignId),
          listingPublicId: listing.listingPublicId,
          expectedVersion
        }
      })
      expect(updated).toMatchObject({
        status,
        version: expectedVersion + 1,
        publishedAt: before.publishedAt,
        summary: 'Original summary',
        title: before.title,
        host: before.host,
        audience: before.audience
      })
      await expect(
        actor.caller.mutation(updateListing, {
          input: {
            ...updateFields(campaignId),
            listingPublicId: listing.listingPublicId,
            expectedVersion
          }
        })
      ).rejects.toThrow()
    }
  })

  it('requires an explicit quota-checked publication after editing a closed listing', async () => {
    const base = await setup()
    await base.t.run((ctx) =>
      ctx.db.insert('accountEntitlements', { userId: base.owner.userId, tier: 'PRO_GM' })
    )
    const competingCampaign = await base.owner.caller.mutation(api.campaigns.create.create, {
      ...campaignInput,
      name: 'Competing public listing'
    })
    const first = await createFor(base)
    const competing = await createFor(base, competingCampaign.id)
    await base.t.run(async (ctx) => {
      const entitlement = await ctx.db
        .query('accountEntitlements')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique()
      if (!entitlement) throw new Error('Missing entitlement.')
      await ctx.db.patch(entitlement._id, { tier: 'FREE' })
    })
    const published = await base.owner.caller.mutation(openListing, {
      listingPublicId: first.listingPublicId,
      expectedVersion: 0
    })
    await base.owner.caller.mutation(closeListing, {
      listingPublicId: first.listingPublicId,
      expectedVersion: 1
    })
    await base.owner.caller.mutation(openListing, {
      listingPublicId: competing.listingPublicId,
      expectedVersion: 0
    })
    const edited = await base.owner.caller.mutation(updateListing, {
      input: {
        ...updateFields(base.campaign.id),
        listingPublicId: first.listingPublicId,
        expectedVersion: 2
      }
    })
    expect(edited).toMatchObject({
      status: 'DRAFT',
      version: 3,
      publishedAt: published.publishedAt
    })
    const before = await base.t.run((ctx) => ctx.db.query('socialListings').collect())
    await expect(
      base.owner.caller.mutation(openListing, {
        listingPublicId: first.listingPublicId,
        expectedVersion: 3
      })
    ).rejects.toThrow('publicListings')
    expect(await base.t.run((ctx) => ctx.db.query('socialListings').collect())).toEqual(before)
    await base.owner.caller.mutation(closeListing, {
      listingPublicId: competing.listingPublicId,
      expectedVersion: 1
    })
    await expect(
      base.owner.caller.mutation(openListing, {
        listingPublicId: first.listingPublicId,
        expectedVersion: 3
      })
    ).resolves.toMatchObject({
      status: 'OPEN',
      version: 4,
      publishedAt: published.publishedAt
    })
  })

  it('allows only active owners to update and preserves state on stale versions', async () => {
    const base = await setup()
    const listing = await createFor(base)
    const before = await base.t.run((ctx) => ctx.db.query('socialListings').collect())
    await expect(
      base.owner.caller.mutation(updateListing, {
        input: {
          ...updateFields(base.campaign.id),
          listingPublicId: listing.listingPublicId,
          expectedVersion: 1
        }
      })
    ).rejects.toThrow('version conflict')
    expect(await base.t.run((ctx) => ctx.db.query('socialListings').collect())).toEqual(before)
    await expect(
      base.other.caller.mutation(updateListing, {
        input: {
          ...updateFields(base.campaign.id),
          listingPublicId: listing.listingPublicId,
          expectedVersion: 0
        }
      })
    ).rejects.toThrow()
    await expect(
      base.t.mutation(updateListing, {
        input: {
          ...updateFields(base.campaign.id),
          listingPublicId: listing.listingPublicId,
          expectedVersion: 0
        }
      })
    ).rejects.toThrow()
    await base.owner.caller.mutation(api.campaigns.archive.archive, {
      campaignId: base.campaign.id,
      expectedVersion: base.campaign.version
    })
    const archived = await base.t.run((ctx) => ctx.db.query('socialListings').collect())
    await expect(
      base.owner.caller.mutation(updateListing, {
        input: {
          ...updateFields(base.campaign.id),
          listingPublicId: listing.listingPublicId,
          expectedVersion: archived[0]!.version
        }
      })
    ).rejects.toThrow()
    expect(await base.t.run((ctx) => ctx.db.query('socialListings').collect())).toEqual(archived)
  })

  it('cannot bypass the PUBLIC quota by changing an OPEN PRIVATE listing, while nonmaterial PUBLIC edits remain allowed', async () => {
    const base = await setup()
    await base.t.run((ctx) =>
      ctx.db.insert('accountEntitlements', { userId: base.owner.userId, tier: 'PRO_GM' })
    )
    const publicCampaign = await base.owner.caller.mutation(api.campaigns.create.create, {
      ...campaignInput,
      name: 'Public quota Campaign'
    })
    const privateCampaign = await base.owner.caller.mutation(api.campaigns.create.create, {
      ...campaignInput,
      name: 'Private quota Campaign'
    })
    const publicListing = await createFor(base, publicCampaign.id)
    const privateListing = await createFor(base, privateCampaign.id, 'PRIVATE')
    await base.t.run(async (ctx) => {
      const entitlement = await ctx.db
        .query('accountEntitlements')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique()
      if (!entitlement) throw new Error('Missing entitlement.')
      await ctx.db.patch(entitlement._id, { tier: 'FREE' })
    })
    await base.owner.caller.mutation(openListing, {
      listingPublicId: publicListing.listingPublicId,
      expectedVersion: 0
    })
    await base.owner.caller.mutation(openListing, {
      listingPublicId: privateListing.listingPublicId,
      expectedVersion: 0
    })
    const before = await base.t.run((ctx) => ctx.db.query('socialListings').collect())
    await expect(
      base.owner.caller.mutation(updateListing, {
        input: {
          ...updateFields(privateCampaign.id, 'PUBLIC'),
          listingPublicId: privateListing.listingPublicId,
          expectedVersion: 1
        }
      })
    ).rejects.toThrow('publicListings')
    expect(await base.t.run((ctx) => ctx.db.query('socialListings').collect())).toEqual(before)
    await expect(
      base.owner.caller.mutation(updateListing, {
        input: {
          ...updateFields(publicCampaign.id, 'PUBLIC'),
          summary: 'Changed summary',
          listingPublicId: publicListing.listingPublicId,
          expectedVersion: 1
        }
      })
    ).resolves.toMatchObject({ status: 'OPEN', version: 2, summary: 'Changed summary' })
  })
})
