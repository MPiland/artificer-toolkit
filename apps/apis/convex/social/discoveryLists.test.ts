import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  SocialBrowseInput,
  SocialSearchInput
} from '@artificer-toolkit/schema/api/socialDiscovery'
import type { SocialListingPage } from '@artificer-toolkit/schema/api/socialListingList'
import type {
  CampaignDetailDto,
  UpdateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  SocialListingDto,
  UpdateSocialListingInput
} from '@artificer-toolkit/schema/api/socialHub'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { fixture } from '../../tests/fixtures/socialWriters'

const browse = makeFunctionReference<'query', SocialBrowseInput, SocialListingPage>(
  'social/discoveryLists:browse'
)
const search = makeFunctionReference<'query', SocialSearchInput, SocialListingPage>(
  'social/discoveryLists:search'
)
const paginationOpts = { cursor: null, numItems: 8 }

async function setup() {
  const base = await fixture()
  const rows = await base.t.run(async (ctx) => {
    const listing = await ctx.db
      .query('socialListings')
      .withIndex('by_publicId', (q) => q.eq('id', base.listing.listingPublicId))
      .unique()
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    const host = await ctx.db
      .query('socialProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
      .unique()
    const viewer = await ctx.db
      .query('socialProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
      .unique()
    if (!listing || !campaign || !host || !viewer) throw new Error('Missing discovery fixture.')
    return { listing, campaign, host, viewer }
  })
  return { ...base, rows }
}

function read(
  base: Awaited<ReturnType<typeof setup>>,
  filters: Omit<SocialBrowseInput, 'paginationOpts'> = {},
  keyword?: string
) {
  return keyword === undefined
    ? base.other.caller.query(browse, { ...filters, paginationOpts })
    : base.other.caller.query(search, { ...filters, paginationOpts, query: keyword })
}

describe('native Social browse and keyword search', () => {
  it('uses every structured filter, any selected tone and all selected safety practices in both modes', async () => {
    const base = await setup()
    await base.t.run((ctx) =>
      ctx.db.patch(base.rows.listing._id, {
        playMode: 'HYBRID',
        location: { city: 'Chicago', stateCode: 'IL' },
        schedule: {
          kind: 'RECURRING',
          timeZone: 'America/Chicago',
          summary: 'Weekly',
          weekday: 0,
          localStartTime: '18:00',
          recurrence: 'WEEKLY'
        },
        expectations: {
          ...base.rows.listing.expectations,
          safetyPractices: ['LINES_AND_VEILS', 'SESSION_ZERO']
        }
      })
    )
    const matching: Omit<SocialBrowseInput, 'paginationOpts'> = {
      systemId: base.listing.system.systemId.toUpperCase(),
      rulesetCode: base.listing.system.rulesetCode,
      rulesetVersion: base.listing.system.rulesetVersion,
      format: 'ONGOING',
      contentMaturity: 'STANDARD',
      toneTags: ['COZY', 'HEROIC'],
      playMode: 'HYBRID',
      scheduleKind: 'RECURRING',
      timeZone: 'America/Chicago',
      weekday: 0,
      stateCode: 'IL',
      city: 'cHiCaGo',
      minimumAvailableSeats: 2,
      safetyPractices: ['SESSION_ZERO', 'LINES_AND_VEILS']
    }
    const mismatches: Omit<SocialBrowseInput, 'paginationOpts'>[] = [
      { systemId: crypto.randomUUID() },
      { rulesetCode: 'missing' },
      { rulesetVersion: 'missing' },
      { format: 'ONE_SHOT' },
      { contentMaturity: 'MATURE' },
      { toneTags: ['COZY', 'DARK'] },
      { playMode: 'ONLINE' },
      { scheduleKind: 'ONE_TIME' },
      { timeZone: 'America/New_York' },
      { weekday: 1 },
      { stateCode: 'TX' },
      { city: 'Austin' },
      { minimumAvailableSeats: 3 },
      { safetyPractices: ['LINES_AND_VEILS', 'X_CARD'] }
    ]
    for (const keyword of [undefined, 'table']) {
      expect((await read(base, matching, keyword)).page.map((row) => row.listingPublicId)).toEqual([
        base.listing.listingPublicId
      ])
      for (const mismatch of mismatches) {
        expect(
          (await read(base, { ...matching, ...mismatch }, keyword)).page,
          JSON.stringify(mismatch)
        ).toEqual([])
      }
    }
  })

  it('reads current Campaign, System and roster data rather than stale listing snapshots', async () => {
    const base = await setup()
    await base.t.run(async (ctx) => {
      await ctx.db.patch(base.rows.campaign._id, {
        format: 'ONE_SHOT',
        toneTags: ['COZY'],
        contentMaturity: 'MATURE'
      })
      await ctx.db.insert('campaignMemberships', {
        campaignId: base.campaign.id,
        userId: base.other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: base.campaign.createdAt,
        joinedAt: base.campaign.createdAt,
        leftAt: null
      })
      const system = await ctx.db
        .query('systems')
        .withIndex('by_publicId', (q) => q.eq('id', base.listing.system.systemId))
        .unique()
      if (!system) throw new Error('Missing System.')
      const document = {
        ...system.document,
        label: 'Current System',
        rulesetCode: 'current-code',
        rulesetVersion: 'current-version'
      }
      await ctx.db.patch(system._id, { document, checksum: checksumRuleDocument(document) })
    })
    for (const keyword of [undefined, 'table']) {
      const result = await read(
        base,
        {
          format: 'ONE_SHOT',
          toneTags: ['COZY'],
          contentMaturity: 'MATURE',
          rulesetCode: 'current-code',
          rulesetVersion: 'current-version',
          minimumAvailableSeats: 1
        },
        keyword
      )
      expect(result.page).toEqual([
        expect.objectContaining({
          availableSeats: 1,
          format: 'ONE_SHOT',
          toneTags: ['COZY'],
          contentMaturity: 'MATURE',
          system: expect.objectContaining({
            label: 'Current System',
            rulesetCode: 'current-code',
            rulesetVersion: 'current-version'
          })
        })
      ])
      expect((await read(base, { minimumAvailableSeats: 2 }, keyword)).page).toEqual([])
      expect((await read(base, { format: 'ONGOING' }, keyword)).page).toEqual([])
      expect(
        (await read(base, { rulesetVersion: base.listing.system.rulesetVersion }, keyword)).page
      ).toEqual([])
    }
    await base.t.run(async (ctx) => {
      const member = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
        )
        .unique()
      if (!member) throw new Error('Missing player.')
      await ctx.db.patch(member._id, { status: 'LEFT', leftAt: base.campaign.createdAt })
    })
    expect((await read(base, { minimumAvailableSeats: 2 })).page[0]?.availableSeats).toBe(2)
  })

  it('preserves publishedAt/id order across more than eight candidates and empty filtered pages', async () => {
    const base = await setup()
    const ids = Array.from(
      { length: 10 },
      (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
    )
    await base.t.run(async (ctx) => {
      const { _id, _creationTime, ...stored } = base.rows.listing
      await ctx.db.delete(_id)
      // Deliberately insert opposite the expected public-id tie ordering.
      for (const [index, id] of ids.entries())
        await ctx.db.insert('socialListings', {
          ...stored,
          id,
          publishedAt: index === 0 ? '2020-01-01T00:00:00.000Z' : '2021-01-01T00:00:00.000Z',
          playMode: index < 2 ? 'IN_PERSON' : 'ONLINE',
          location: index < 2 ? { city: 'Chicago', stateCode: 'IL' } : null
        })
    })
    const first = await base.other.caller.query(browse, {
      paginationOpts: { cursor: null, numItems: 48 }
    })
    expect(first.page.map((row) => row.listingPublicId)).toEqual(ids.slice(2).reverse())
    expect(first.isDone).toBe(false)
    const keywordPage = await base.other.caller.query(search, {
      paginationOpts,
      query: 'table'
    })
    expect(keywordPage.page).toHaveLength(8)
    expect(keywordPage.isDone).toBe(false)
    const keywordNext = await base.other.caller.query(search, {
      paginationOpts: { cursor: keywordPage.continueCursor, numItems: 8 },
      query: 'table'
    })
    expect(
      new Set([...keywordPage.page, ...keywordNext.page].map((row) => row.listingPublicId)).size
    ).toBe(10)
    expect(keywordNext.isDone).toBe(true)
    const next = await base.other.caller.query(browse, {
      paginationOpts: { ...paginationOpts, cursor: first.continueCursor }
    })
    expect(next.page.map((row) => row.listingPublicId)).toEqual([ids[1], ids[0]])
    expect(next.isDone).toBe(true)
    const empty = await base.other.caller.query(browse, { paginationOpts, playMode: 'IN_PERSON' })
    expect(empty.page).toEqual([])
    expect(empty.isDone).toBe(false)
    expect(empty.continueCursor).toBe(first.continueCursor)
    const continuation = await base.other.caller.query(browse, {
      paginationOpts: { ...paginationOpts, cursor: empty.continueCursor },
      playMode: 'IN_PERSON'
    })
    expect(continuation.page.map((row) => row.listingPublicId)).toEqual([ids[1], ids[0]])
  })

  it('searches title and summary keywords and last-token prefixes, not arbitrary substrings', async () => {
    const base = await setup()
    for (const keyword of ['campaign', 'table', 'tabl']) {
      expect((await read(base, {}, keyword)).page.map((row) => row.listingPublicId)).toEqual([
        base.listing.listingPublicId
      ])
    }
    for (const keyword of ['absentword', 'able'])
      expect((await read(base, {}, keyword)).page).toEqual([])
    await expect(
      base.other.caller.query(search, { paginationOpts, query: '   ' })
    ).rejects.toThrow()
    await expect(
      base.other.caller.query(search, {
        paginationOpts: { cursor: null, numItems: 9 },
        query: 'table'
      })
    ).rejects.toThrow()
  })

  it('updates indexed keywords through real Campaign renames and listing summary edits', async () => {
    const base = await setup()
    const updateCampaign = makeFunctionReference<
      'mutation',
      UpdateCampaignInput,
      CampaignDetailDto
    >('campaigns/update:update')
    const updateListing = makeFunctionReference<
      'mutation',
      { input: UpdateSocialListingInput },
      SocialListingDto
    >('social/listings:update')
    await base.owner.caller.mutation(updateCampaign, {
      campaignId: base.campaign.id,
      expectedVersion: base.campaign.version,
      name: 'Moonstone expedition'
    })
    expect((await read(base, {}, 'campaign')).page).toEqual([])
    const renamed = (await read(base, {}, 'moonstone')).page[0]!
    expect(renamed.title).toBe('Moonstone expedition')
    const stored = base.rows.listing
    await base.owner.caller.mutation(updateListing, {
      input: {
        listingPublicId: stored.id,
        expectedVersion: renamed.version,
        summary: 'Explore sapphire caverns',
        audience: stored.audience,
        systemId: stored.systemId,
        playMode: stored.playMode,
        capacity: stored.capacity,
        schedule: stored.schedule,
        location: stored.location,
        expectations: stored.expectations
      }
    })
    expect((await read(base, {}, 'table')).page).toEqual([])
    expect((await read(base, {}, 'sapphire')).page[0]?.summary).toBe('Explore sapphire caverns')
    expect((await read(base, {}, 'moonstone')).page).toHaveLength(1)
    const state = await base.snapshot()
    expect(state.listings[0]?.search).toEqual({
      version: 1,
      text: 'Moonstone expedition Explore sapphire caverns'
    })
  })

  it('omits non-public states and archived Campaigns even for their owner', async () => {
    const base = await setup()
    for (const state of [
      { status: 'OPEN', audience: 'PRIVATE', moderationStatus: 'VISIBLE' },
      { status: 'DRAFT', audience: 'PUBLIC', moderationStatus: 'VISIBLE' },
      { status: 'CLOSED', audience: 'PUBLIC', moderationStatus: 'VISIBLE' },
      { status: 'OPEN', audience: 'PUBLIC', moderationStatus: 'HIDDEN' }
    ] as const) {
      await base.t.run((ctx) => ctx.db.patch(base.rows.listing._id, state))
      for (const keyword of [undefined, 'table'])
        expect((await read(base, {}, keyword)).page).toEqual([])
      expect((await base.owner.caller.query(browse, { paginationOpts })).page).toEqual([])
    }
    await base.t.run(async (ctx) => {
      await ctx.db.patch(base.rows.listing._id, {
        status: 'OPEN',
        audience: 'PUBLIC',
        moderationStatus: 'VISIBLE'
      })
      await ctx.db.patch(base.rows.campaign._id, { status: 'ARCHIVED' })
    })
    for (const keyword of [undefined, 'table'])
      expect((await read(base, {}, keyword)).page).toEqual([])
  })

  it('applies both block directions and active host/viewer requirements without mutating business data', async () => {
    const base = await setup()
    const before = await base.snapshot()
    for (const reverse of [false, true]) {
      const blockId = await base.t.run((ctx) =>
        ctx.db.insert('socialBlocks', {
          blockerProfileId: reverse ? base.rows.viewer.id : base.rows.host.id,
          blockedProfileId: reverse ? base.rows.host.id : base.rows.viewer.id,
          createdAt: base.campaign.createdAt
        })
      )
      for (const keyword of [undefined, 'table'])
        expect((await read(base, {}, keyword)).page).toEqual([])
      await base.t.run((ctx) => ctx.db.delete(blockId))
    }
    await base.t.run((ctx) => ctx.db.patch(base.rows.host._id, { status: 'SUSPENDED' }))
    for (const keyword of [undefined, 'table'])
      expect((await read(base, {}, keyword)).page).toEqual([])
    await base.t.run((ctx) => ctx.db.delete(base.rows.host._id))
    for (const keyword of [undefined, 'table'])
      expect((await read(base, {}, keyword)).page).toEqual([])
    await expect(base.t.query(browse, { paginationOpts })).rejects.toThrow('Unauthenticated')
    await expect(base.t.query(search, { paginationOpts, query: 'table' })).rejects.toThrow(
      'Unauthenticated'
    )
    await base.t.run((ctx) => ctx.db.patch(base.rows.viewer._id, { status: 'SUSPENDED' }))
    for (const keyword of [undefined, 'table'])
      await expect(read(base, {}, keyword)).rejects.toThrow('active Social profile')
    await base.t.run((ctx) => ctx.db.delete(base.rows.viewer._id))
    for (const keyword of [undefined, 'table'])
      await expect(read(base, {}, keyword)).rejects.toThrow('active Social profile')
    expect(await base.snapshot()).toEqual(before)
  })

  it('masks public prose, exposes no private fields and honors only attested Mature preference or ownership', async () => {
    const base = await setup()
    for (const keyword of [undefined, 'table']) {
      const row = (await read(base, {}, keyword)).page[0]!
      expect(Object.keys(row).sort()).toEqual(Object.keys(base.listing).sort())
      expect(Object.keys(row.host).sort()).toEqual(['profilePublicId', 'username'])
      expect(row).toMatchObject({
        title: 'A ****storm campaign',
        expectations: { contentGuidance: 'A ****storm of adventure' }
      })
      for (const secret of [
        'campaignId',
        'ownerUserId',
        'userId',
        'email',
        'bio',
        'search',
        'memberships',
        'application',
        'invitation'
      ])
        expect(row).not.toHaveProperty(secret)
    }
    expect((await base.owner.caller.query(browse, { paginationOpts })).page[0]?.title).toBe(
      'A ****storm campaign'
    )
    await base.t.run((ctx) => ctx.db.patch(base.rows.campaign._id, { contentMaturity: 'MATURE' }))
    expect(
      (await base.owner.caller.query(search, { paginationOpts, query: 'table' })).page[0]?.title
    ).toBe('A shitstorm campaign')
    for (const keyword of [undefined, 'table'])
      expect((await read(base, {}, keyword)).page[0]?.title).toBe('A ****storm campaign')
    await base.t.run((ctx) =>
      ctx.db.patch(base.rows.viewer._id, {
        contentPreference: 'MATURE',
        adultAttestedAt: base.campaign.createdAt
      })
    )
    for (const keyword of [undefined, 'table'])
      expect((await read(base, {}, keyword)).page[0]?.title).toBe('A shitstorm campaign')
    await base.t.run((ctx) => ctx.db.patch(base.rows.viewer._id, { adultAttestedAt: null }))
    for (const keyword of [undefined, 'table'])
      await expect(read(base, {}, keyword)).rejects.toThrow()
  })
})
