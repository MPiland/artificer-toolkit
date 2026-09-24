import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CreateSocialListingInput,
  UpdateSocialListingInput,
  SocialEligibilityDto,
  SocialListingDto
} from '@artificer-toolkit/schema/api/socialHub'
import type {
  SocialListingListInput,
  SocialListingPage
} from '@artificer-toolkit/schema/api/socialListingList'
import { socialListingDtoSchema } from '@artificer-toolkit/schema/api/socialHub'
import { ENTITLEMENT_LIMITS } from '@artificer-toolkit/shared/account/entitlements'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture as characterFixture } from '../../tests/fixtures/characters'
import { api } from '../_generated/api'

const campaignCreate = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const initialize = makeFunctionReference<'mutation', Record<string, never>, SocialEligibilityDto>(
  'social/profiles:initialize'
)
const create = makeFunctionReference<
  'mutation',
  { input: CreateSocialListingInput },
  SocialListingDto
>('social/listingDrafts:create')
const update = makeFunctionReference<
  'mutation',
  { input: UpdateSocialListingInput },
  SocialListingDto
>('social/listingDrafts:update')
const get = makeFunctionReference<'query', { listingPublicId: string }, SocialListingDto>(
  'social/listingDrafts:get'
)
const list = makeFunctionReference<'query', SocialListingListInput, SocialListingPage>(
  'social/listingDrafts:list'
)
const remove = makeFunctionReference<
  'mutation',
  { listingPublicId: string; expectedVersion: number },
  null
>('social/listingDrafts:remove')
const campaignInput: CreateCampaignInput = {
  name: 'Private damn Campaign',
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  contentMaturity: 'STANDARD',
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}
const pageInput: SocialListingListInput = { paginationOpts: { cursor: null, numItems: 1 } }

function input(campaignId: string): CreateSocialListingInput {
  return {
    campaignId,
    summary: 'Private damn draft',
    audience: 'PUBLIC',
    systemId: srdSystemRecord.id,
    playMode: 'ONLINE',
    capacity: 2,
    schedule: { kind: 'FLEXIBLE', timeZone: 'America/Chicago', summary: 'Agree a date' },
    location: null,
    expectations: {
      contentGuidance: 'Fantasy',
      attendancePolicy: 'Tell us',
      allowedContentRules: 'SRD',
      tableConduct: 'Be kind',
      contentBoundaries: 'Discuss together',
      safetyPractices: ['LINES_AND_VEILS'],
      safetyDetails: 'Pause when needed'
    }
  }
}

async function fixture(initializeSocial = true) {
  const base = await characterFixture()
  for (const [actor, username] of [
    [base.owner, 'SocialOwner'],
    [base.other, 'SocialOther']
  ] as const) {
    await actor.caller.mutation(api.account.updateProfile, { username, bio: null })
    if (initializeSocial) await actor.caller.mutation(initialize, {})
  }
  const campaign = await base.owner.caller.mutation(campaignCreate, campaignInput)
  return { ...base, campaign }
}

async function rows(t: Awaited<ReturnType<typeof fixture>>['t']) {
  return t.run((ctx) => ctx.db.query('socialListings').take(20))
}

describe('native Social listing drafts', () => {
  it('canonicalizes UUID case for owner reads, one-listing identity and Campaign lifecycle cleanup', async () => {
    const { t, owner, campaign } = await fixture()
    const created = await owner.caller.mutation(create, { input: input(campaign.id.toUpperCase()) })
    expect((await rows(t))[0]).toMatchObject({ campaignId: campaign.id })
    await expect(
      owner.caller.query(get, { listingPublicId: created.listingPublicId.toUpperCase() })
    ).resolves.toMatchObject({ listingPublicId: created.listingPublicId })
    await expect(owner.caller.mutation(create, { input: input(campaign.id) })).rejects.toThrow(
      'already has'
    )
    await owner.caller.mutation(api.campaigns.archive.archive, {
      campaignId: campaign.id,
      expectedVersion: campaign.version
    })
    expect((await rows(t))[0]).toMatchObject({ campaignId: campaign.id, status: 'CLOSED' })
  })

  it('requires identity and active Social eligibility without implicitly creating it', async () => {
    const { t, owner, campaign } = await fixture(false)
    const lookup = { listingPublicId: crypto.randomUUID() }
    for (const action of [
      t.mutation(create, { input: input(campaign.id) }),
      t.query(get, lookup),
      t.query(list, pageInput),
      t.mutation(update, { input: { ...input(campaign.id), ...lookup, expectedVersion: 0 } }),
      t.mutation(remove, { ...lookup, expectedVersion: 0 })
    ])
      await expect(action).rejects.toThrow()
    await expect(owner.caller.mutation(create, { input: input(campaign.id) })).rejects.toThrow(
      'active Social profile'
    )
    expect(await t.run((ctx) => ctx.db.query('socialProfiles').take(1))).toEqual([])
    expect(await rows(t)).toEqual([])
  })

  it('creates one draft per Campaign under contention and returns only the private edit DTO with current derived facts', async () => {
    const { t, owner, other, campaign } = await fixture()
    const outcomes = await Promise.allSettled([
      owner.caller.mutation(create, { input: input(campaign.id) }),
      owner.caller.mutation(create, { input: input(campaign.id) })
    ])
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1)
    const saved = (await rows(t))[0]!
    expect(saved).toMatchObject({
      status: 'DRAFT',
      version: 0,
      publishedAt: null,
      campaignId: campaign.id,
      ownerUserId: owner.userId
    })
    const lookup = { listingPublicId: saved.id }
    const draft = await owner.caller.query(get, lookup)
    expect(draft).toMatchObject({
      title: campaignInput.name,
      summary: input(campaign.id).summary,
      host: { username: 'SocialOwner' },
      isFree: true,
      availableSeats: 2,
      ageBand: '13_PLUS'
    })
    expect(Object.keys(draft).sort()).toEqual(Object.keys(socialListingDtoSchema.shape).sort())
    expect(draft.listingPublicId).not.toBe(campaign.id)
    expect(draft.host.profilePublicId).not.toBe(owner.userId)
    for (const secret of ['campaignId', 'ownerUserId', 'userId', '_id', 'email', 'memberships'])
      expect(draft).not.toHaveProperty(secret)
    await expect(other.caller.query(get, lookup)).rejects.toThrow('not found')
    await expect(other.caller.mutation(create, { input: input(campaign.id) })).rejects.toThrow(
      'not found'
    )
    expect((await other.caller.query(list, pageInput)).page).toEqual([])
    await owner.caller.mutation(api.account.updateProfile, { username: 'RenamedOwner', bio: null })
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      if (!row) throw new Error('Missing Campaign')
      await ctx.db.patch(row._id, {
        name: 'Current Campaign name',
        toneTags: ['HORROR'],
        contentMaturity: 'MATURE'
      })
      const now = new Date().toISOString()
      await ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        joinedAt: now,
        accessStartedAt: now,
        leftAt: null
      })
    })
    expect(await owner.caller.query(get, lookup)).toMatchObject({
      title: 'Current Campaign name',
      toneTags: ['HORROR'],
      contentMaturity: 'MATURE',
      host: { username: 'RenamedOwner' },
      availableSeats: 1
    })
    await expect(other.caller.query(get, lookup)).rejects.toThrow('not found')
  })

  it('validates free-table inputs, System existence, schedule, archive and live tier capacity without partial writes', async () => {
    const { t, owner, campaign } = await fixture()
    const good = input(campaign.id)
    for (const invalid of [
      { ...good, expectations: { ...good.expectations, safetyPractices: [] } },
      ...[
        'contentGuidance',
        'attendancePolicy',
        'allowedContentRules',
        'tableConduct',
        'contentBoundaries',
        'safetyDetails'
      ].map((field) => ({
        ...good,
        expectations: { ...good.expectations, [field]: '' }
      })),
      { ...good, systemId: crypto.randomUUID() },
      { ...good, capacity: ENTITLEMENT_LIMITS.FREE.playerSeatsPerCampaign + 1 },
      { ...good, capacity: 0 },
      { ...good, playMode: 'IN_PERSON' as const },
      { ...good, location: { city: 'Chicago', stateCode: 'IL' } },
      { ...good, schedule: { ...good.schedule, timeZone: 'Not/AZone' } }
    ])
      await expect(owner.caller.mutation(create, { input: invalid })).rejects.toThrow()
    const forged = makeFunctionReference<
      'mutation',
      { input: CreateSocialListingInput & { isFree: false } },
      SocialListingDto
    >('social/listingDrafts:create')
    await expect(
      owner.caller.mutation(forged, { input: { ...good, isFree: false } })
    ).rejects.toThrow()
    expect(await rows(t)).toEqual([])
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      if (!row) throw new Error('Missing Campaign')
      await ctx.db.patch(row._id, { format: 'ONE_SHOT' })
    })
    await expect(
      owner.caller.mutation(create, {
        input: {
          ...good,
          schedule: {
            kind: 'RECURRING',
            timeZone: 'America/Chicago',
            summary: 'Weekly',
            weekday: 1,
            localStartTime: '18:30',
            recurrence: 'WEEKLY'
          }
        }
      })
    ).rejects.toThrow('recurring')
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      if (!row) throw new Error('Missing Campaign')
      await ctx.db.patch(row._id, { status: 'ARCHIVED' })
    })
    await expect(owner.caller.mutation(create, { input: good })).rejects.toThrow('Archived')
    expect(await rows(t)).toEqual([])
  })

  it('applies optimistic version checks to update/delete, preserves server fields, and excludes non-draft lifecycle writes', async () => {
    const { t, owner, other, campaign } = await fixture()
    const original = await owner.caller.mutation(create, { input: input(campaign.id) })
    const { campaignId: _campaignId, ...fields } = input(campaign.id)
    const change: UpdateSocialListingInput = {
      ...fields,
      listingPublicId: original.listingPublicId,
      expectedVersion: 0,
      summary: 'Edited',
      schedule: {
        kind: 'ONE_TIME',
        summary: 'Tomorrow',
        timeZone: 'America/Chicago',
        startsAt: '2099-01-01T20:00:00.000Z'
      }
    }
    await expect(other.caller.mutation(update, { input: change })).rejects.toThrow('not found')
    await expect(
      other.caller.mutation(remove, {
        listingPublicId: original.listingPublicId,
        expectedVersion: 0
      })
    ).rejects.toThrow('not found')
    const updates = await Promise.allSettled([
      owner.caller.mutation(update, { input: change }),
      owner.caller.mutation(update, { input: change })
    ])
    expect(updates.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
    expect(updates.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1)
    const saved = await rows(t)
    expect(saved[0]).toMatchObject({
      id: original.listingPublicId,
      campaignId: campaign.id,
      ownerUserId: owner.userId,
      version: 1,
      summary: 'Edited',
      status: 'DRAFT',
      publishedAt: null
    })
    await expect(
      owner.caller.mutation(remove, {
        listingPublicId: original.listingPublicId,
        expectedVersion: 0
      })
    ).rejects.toThrow('version conflict')
    expect(await rows(t)).toEqual(saved)
    for (const status of ['OPEN', 'CLOSED'] as const) {
      await t.run((ctx) => ctx.db.patch(saved[0]!._id, { status }))
      await expect(
        owner.caller.mutation(update, { input: { ...change, expectedVersion: 1 } })
      ).rejects.toThrow('Only draft')
      await expect(
        owner.caller.mutation(remove, {
          listingPublicId: original.listingPublicId,
          expectedVersion: 1
        })
      ).rejects.toThrow('Only draft')
      expect((await owner.caller.query(list, pageInput)).page).toEqual([])
    }
    await t.run((ctx) =>
      ctx.db.patch(saved[0]!._id, { status: 'DRAFT', moderationStatus: 'HIDDEN' })
    )
    const edited = await owner.caller.mutation(update, { input: { ...change, expectedVersion: 1 } })
    expect(edited).toMatchObject({ moderationStatus: 'HIDDEN', version: 2 })
    await owner.caller.mutation(remove, {
      listingPublicId: original.listingPublicId,
      expectedVersion: 2
    })
    expect(await rows(t)).toEqual([])
    const recreated = await owner.caller.mutation(create, { input: input(campaign.id) })
    expect(recreated.listingPublicId).not.toBe(original.listingPublicId)
  })

  it('rechecks active membership count and owner tier on create and update, not just the input maximum', async () => {
    const { t, owner, campaign } = await fixture()
    await t.run(async (ctx) => {
      const now = new Date().toISOString()
      for (let index = 0; index < 3; index++)
        await ctx.db.insert('campaignMemberships', {
          campaignId: campaign.id,
          userId: crypto.randomUUID(),
          role: 'PLAYER',
          status: 'ACTIVE',
          accessStartedAt: now,
          joinedAt: now,
          leftAt: null
        })
    })
    await expect(owner.caller.mutation(create, { input: input(campaign.id) })).rejects.toThrow(
      'active player count'
    )
    const entitlementId = await t.run(async (ctx) => {
      const row = await ctx.db
        .query('accountEntitlements')
        .withIndex('by_userId', (q) => q.eq('userId', owner.userId))
        .unique()
      if (!row)
        return ctx.db.insert('accountEntitlements', { userId: owner.userId, tier: 'PRO_GM' })
      await ctx.db.patch(row._id, { tier: 'PRO_GM' })
      return row._id
    })
    const draft = await owner.caller.mutation(create, {
      input: { ...input(campaign.id), capacity: ENTITLEMENT_LIMITS.PRO_GM.playerSeatsPerCampaign }
    })
    const { campaignId: _campaignId, ...fields } = input(campaign.id)
    await t.run((ctx) => ctx.db.patch(entitlementId, { tier: 'FREE' }))
    await expect(
      owner.caller.mutation(update, {
        input: {
          ...fields,
          listingPublicId: draft.listingPublicId,
          expectedVersion: 0,
          capacity: draft.capacity
        }
      })
    ).rejects.toThrow('player seat limit')
    await expect(
      owner.caller.mutation(update, {
        input: { ...fields, listingPublicId: draft.listingPublicId, expectedVersion: 0 }
      })
    ).rejects.toThrow('active player count')
    expect((await rows(t))[0]!.version).toBe(0)
  })

  it('pages every owned draft without leaking other owners or trusting a stale owner index', async () => {
    const { t, owner, other, campaign } = await fixture()
    await t.run(async (ctx) => {
      const entitlement = await ctx.db
        .query('accountEntitlements')
        .withIndex('by_userId', (q) => q.eq('userId', owner.userId))
        .unique()
      if (entitlement) await ctx.db.patch(entitlement._id, { tier: 'PRO_GM' })
      else await ctx.db.insert('accountEntitlements', { userId: owner.userId, tier: 'PRO_GM' })
    })
    const first = await owner.caller.mutation(create, { input: input(campaign.id) })
    const secondCampaign = await owner.caller.mutation(campaignCreate, {
      ...campaignInput,
      name: 'Second'
    })
    const second = await owner.caller.mutation(create, { input: input(secondCampaign.id) })
    const otherCampaign = await other.caller.mutation(campaignCreate, campaignInput)
    await other.caller.mutation(create, { input: input(otherCampaign.id) })
    const seen: string[] = []
    let cursor: string | null = null
    for (let pageNumber = 0; pageNumber < 5; pageNumber++) {
      const page: SocialListingPage = await owner.caller.query(list, {
        paginationOpts: { cursor, numItems: 1 }
      })
      seen.push(...page.page.map((entry) => entry.listingPublicId))
      if (page.isDone) break
      cursor = page.continueCursor
    }
    expect(seen.sort()).toEqual([first.listingPublicId, second.listingPublicId].sort())
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      if (!row) throw new Error('Missing Campaign')
      await ctx.db.patch(row._id, { ownerUserId: other.userId })
    })
    await expect(
      owner.caller.query(get, { listingPublicId: first.listingPublicId })
    ).rejects.toThrow('authority mismatch')
    await expect(
      owner.caller.query(list, { paginationOpts: { cursor: null, numItems: 10 } })
    ).rejects.toThrow('authority mismatch')
  })

  it('denies suspended owners and forged owner/status fields, but permits deleting an archived Campaign draft', async () => {
    const { t, owner, campaign } = await fixture()
    const draft = await owner.caller.mutation(create, { input: input(campaign.id) })
    const lookup = { listingPublicId: draft.listingPublicId }
    const { campaignId: _campaignId, ...fields } = input(campaign.id)
    const forged = makeFunctionReference<
      'mutation',
      { input: UpdateSocialListingInput & { ownerUserId: string; status: 'OPEN' } },
      SocialListingDto
    >('social/listingDrafts:update')
    await expect(
      owner.caller.mutation(forged, {
        input: {
          ...fields,
          ...lookup,
          expectedVersion: 0,
          ownerUserId: crypto.randomUUID(),
          status: 'OPEN'
        }
      })
    ).rejects.toThrow()
    const profileId = await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', owner.userId))
        .unique()
      if (!profile) throw new Error('Missing Social profile')
      await ctx.db.patch(profile._id, { status: 'SUSPENDED' })
      return profile._id
    })
    await expect(owner.caller.query(get, lookup)).rejects.toThrow('active Social profile')
    await expect(owner.caller.query(list, pageInput)).rejects.toThrow('active Social profile')
    await expect(
      owner.caller.mutation(update, { input: { ...fields, ...lookup, expectedVersion: 0 } })
    ).rejects.toThrow('active Social profile')
    await expect(owner.caller.mutation(remove, { ...lookup, expectedVersion: 0 })).rejects.toThrow(
      'active Social profile'
    )
    await t.run(async (ctx) => {
      await ctx.db.patch(profileId, { status: 'ACTIVE' })
      const row = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      if (!row) throw new Error('Missing Campaign')
      await ctx.db.patch(row._id, { status: 'ARCHIVED' })
    })
    await expect(
      owner.caller.mutation(update, { input: { ...fields, ...lookup, expectedVersion: 0 } })
    ).rejects.toThrow('Archived')
    expect(await owner.caller.query(get, lookup)).toMatchObject({ version: 0 })
    await expect(
      owner.caller.mutation(remove, { ...lookup, expectedVersion: 0 })
    ).resolves.toBeNull()
    expect(await rows(t)).toEqual([])
  })
})
