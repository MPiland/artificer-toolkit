import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type {
  socialBlockInputSchema,
  socialListingPublicIdInputSchema,
  SocialApplicationDto,
  SocialBlockDto,
  SocialListingDto,
  SubmitSocialApplicationInput
} from '@artificer-toolkit/schema/api/socialHub'
import type {
  CampaignInviteDto,
  CreateCampaignInviteInput
} from '@artificer-toolkit/schema/api/campaignCore'
import {
  socialStoredBlockInvalidationSchema,
  socialStoredBlockSchema
} from '@artificer-toolkit/schema/projections/socialPersistence'
import { fixture } from '../../tests/fixtures/socialWriters'

const remove = makeFunctionReference<'mutation', z.input<typeof socialBlockInputSchema>, null>(
  'social/blocks:remove'
)
const create = makeFunctionReference<
  'mutation',
  z.input<typeof socialBlockInputSchema>,
  SocialBlockDto
>('social/blocks:create')
const invite = makeFunctionReference<'mutation', CreateCampaignInviteInput, CampaignInviteDto>(
  'social/invitations:create'
)
const cleanup = makeFunctionReference<
  'mutation',
  {
    firstProfileId: string
    secondProfileId: string
    firstUserId: string
    secondUserId: string
    generation: number
    invalidatedAt: string
    phase: 'APPLICATION_FIRST' | 'APPLICATION_SECOND' | 'INVITATION_FIRST' | 'INVITATION_SECOND'
    cursor: null
  },
  null
>('social/blockCleanup:run')
const getListing = makeFunctionReference<
  'query',
  z.input<typeof socialListingPublicIdInputSchema>,
  SocialListingDto
>('social/discovery:getListing')
const submit = makeFunctionReference<
  'mutation',
  SubmitSocialApplicationInput,
  SocialApplicationDto
>('social/applications:submit')

async function blockedFixture() {
  const base = await fixture()
  const application = await base.other.caller.mutation(submit, {
    listingPublicId: base.listing.listingPublicId,
    expectedListingVersion: base.listing.version,
    message: 'Keep the original application history.'
  })
  const pair = await base.t.run(async (ctx) => {
    const owner = await ctx.db
      .query('socialProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
      .unique()
    const other = await ctx.db
      .query('socialProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
      .unique()
    const source = await ctx.db
      .query('socialApplications')
      .withIndex('by_publicId', (q) => q.eq('id', application.applicationPublicId))
      .unique()
    if (!owner || !other || !source) throw new Error('Missing Social fixture.')
    const now = new Date().toISOString()
    await ctx.db.patch(source._id, { status: 'BLOCKED', blockedAt: now })
    await ctx.db.insert(
      'socialBlocks',
      socialStoredBlockSchema.parse({
        blockerProfileId: owner.id,
        blockedProfileId: other.id,
        createdAt: now
      })
    )
    return { owner, other }
  })
  const snapshot = async () => ({
    ...(await base.snapshot()),
    blocks: await base.t.run((ctx) => ctx.db.query('socialBlocks').collect())
  })
  return { ...base, ...pair, ownerActor: base.owner, otherActor: base.other, snapshot }
}

describe('native Social block removal', () => {
  it('rejects a retained invalidation with a noncanonical or aliased pair', () => {
    expect(
      socialStoredBlockInvalidationSchema.safeParse({
        firstProfileId: '00000000-0000-4000-8000-000000000002',
        secondProfileId: '00000000-0000-4000-8000-000000000001',
        firstUserId: '00000000-0000-4000-8000-000000000003',
        secondUserId: '00000000-0000-4000-8000-000000000003',
        generation: 1,
        invalidatedAt: new Date().toISOString()
      }).success
    ).toBe(false)
  })
  it('creates one directional marker and invalidation, rejects reverse blocking, and rolls back a limited create', async () => {
    const base = await fixture()
    const [ownerProfile, otherProfile] = await base.t.run(async (ctx) => [
      await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique(),
      await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
        .unique()
    ])
    if (!ownerProfile || !otherProfile) throw new Error('Missing Social profiles.')
    const created = await base.owner.caller.mutation(create, { profilePublicId: otherProfile.id })
    expect(created).toMatchObject({ profile: { profilePublicId: otherProfile.id } })
    const invalidation = await base.t.run((ctx) =>
      ctx.db.query('socialBlockInvalidations').collect()
    )
    expect(invalidation).toMatchObject([{ generation: 1 }])
    await expect(
      base.other.caller.mutation(create, { profilePublicId: ownerProfile.id })
    ).rejects.toThrow('Social profile not found.')
    const third = await base.addActor('BlockedThird')
    const thirdProfile = await base.t.run((ctx) =>
      ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', third.userId))
        .unique()
    )
    if (!thirdProfile) throw new Error('Missing third Social profile.')
    await base.t.run(async (ctx) => {
      const limit = await ctx.db
        .query('socialActionRateLimits')
        .withIndex('by_userId_action_window', (q) =>
          q.eq('userId', base.owner.userId).eq('action', 'BLOCK').eq('window', 'HOUR')
        )
        .unique()
      if (!limit) throw new Error('Missing block allowance.')
      await ctx.db.patch(limit._id, { count: 30 })
    })
    const before = await base.snapshot()
    await expect(
      base.owner.caller.mutation(create, { profilePublicId: thirdProfile.id })
    ).rejects.toThrow('Too many Social actions')
    expect(await base.snapshot()).toEqual(before)
  })
  it('keeps a blocked generation invalid after unblock until bounded cleanup finalizes it', async () => {
    const base = await fixture()
    const application = await base.other.caller.mutation(submit, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      message: 'Pending before block.'
    })
    const invitation = await base.owner.caller.mutation(invite, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      username: 'AdmissionPlayer'
    })
    const [owner, other] = await base.t.run(async (ctx) => [
      await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique(),
      await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
        .unique()
    ])
    if (!owner || !other) throw new Error('Missing Social profiles.')
    await base.owner.caller.mutation(create, { profilePublicId: other.id })
    await base.owner.caller.mutation(remove, { profilePublicId: other.id })
    const barrier = await base.t.run((ctx) => ctx.db.query('socialBlockInvalidations').collect())
    expect(barrier).toHaveLength(1)
    const {
      _id: _eventId,
      _creationTime: _eventCreatedAt,
      committedAt: _committedAt,
      ...event
    } = barrier[0]!
    await expect(
      base.other.caller.mutation(submit, {
        listingPublicId: base.listing.listingPublicId,
        expectedListingVersion: base.listing.version,
        message: 'Old request must be replaced.'
      })
    ).resolves.toMatchObject({ status: 'SUBMITTED' })
    for (const phase of [
      'APPLICATION_FIRST',
      'APPLICATION_SECOND',
      'INVITATION_FIRST',
      'INVITATION_SECOND'
    ] as const) {
      await base.t.mutation(cleanup, { ...event, phase, cursor: null })
    }
    const rows = await base.snapshot()
    expect(
      rows.applications.find((row) => row.id === application.applicationPublicId)
    ).toMatchObject({
      status: 'BLOCKED',
      version: 1
    })
    expect(rows.invitations.find((row) => row.id === invitation.invitePublicId)).toMatchObject({
      status: 'REVOKED',
      version: 1
    })
  })
  it('removes only the caller direction and never restores blocked applications or changes membership/history', async () => {
    const base = await blockedFixture()
    await base.t.run((ctx) =>
      ctx.db.insert(
        'socialBlocks',
        socialStoredBlockSchema.parse({
          blockerProfileId: base.other.id,
          blockedProfileId: base.owner.id,
          createdAt: new Date().toISOString()
        })
      )
    )
    const before = await base.snapshot()
    await expect(
      base.ownerActor.caller.mutation(remove, {
        profilePublicId: base.other.id.toUpperCase()
      })
    ).resolves.toBeNull()
    const after = await base.snapshot()
    expect(after.blocks).toEqual(
      before.blocks.filter((row) => row.blockerProfileId === base.other.id)
    )
    const { blocks: _beforeBlocks, rates: beforeRates, ...beforeSource } = before
    const { blocks: _afterBlocks, rates: afterRates, ...afterSource } = after
    expect(afterSource).toEqual(beforeSource)
    expect(afterRates.filter((row) => row.action !== 'BLOCK')).toEqual(beforeRates)
    expect(afterRates.filter((row) => row.action === 'BLOCK')).toMatchObject([
      { userId: base.ownerActor.userId, window: 'HOUR', count: 1 }
    ])
    await expect(
      base.otherActor.caller.query(getListing, {
        listingPublicId: base.listing.listingPublicId
      })
    ).rejects.toThrow('Social listing not found')
    await expect(
      base.ownerActor.caller.mutation(remove, {
        profilePublicId: base.other.id
      })
    ).rejects.toThrow('Social block not found')
    expect(await base.snapshot()).toEqual(after)
    await base.otherActor.caller.mutation(remove, { profilePublicId: base.owner.id })
    expect(
      await base.otherActor.caller.query(getListing, {
        listingPublicId: base.listing.listingPublicId
      })
    ).toMatchObject({ listingPublicId: base.listing.listingPublicId })
    expect((await base.snapshot()).applications).toEqual(before.applications)
  })

  it('requires the active blocker, preserves data on rejection, and allows removing a suspended target', async () => {
    const base = await blockedFixture()
    const input = { profilePublicId: base.other.id }
    const before = await base.snapshot()
    await expect(base.t.mutation(remove, input)).rejects.toThrow('Unauthenticated')
    await expect(base.otherActor.caller.mutation(remove, input)).rejects.toThrow(
      'Social block not found'
    )
    await expect(
      base.ownerActor.caller.mutation(remove, {
        profilePublicId: crypto.randomUUID()
      })
    ).rejects.toThrow('Social block not found')
    expect(await base.snapshot()).toEqual(before)
    await base.t.run((ctx) => ctx.db.patch(base.owner._id, { status: 'SUSPENDED' }))
    await expect(base.ownerActor.caller.mutation(remove, input)).rejects.toThrow(
      'An active Social profile'
    )
    expect(await base.snapshot()).toEqual(before)
    await base.t.run(async (ctx) => {
      await ctx.db.patch(base.owner._id, { status: 'ACTIVE' })
      await ctx.db.patch(base.other._id, { status: 'SUSPENDED' })
    })
    await expect(base.ownerActor.caller.mutation(remove, input)).resolves.toBeNull()
  })

  it('rolls back a rate-limited removal and consumes one allowance for competing removals', async () => {
    const base = await blockedFixture()
    const input = { profilePublicId: base.other.id }
    const counterId = await base.t.run((ctx) =>
      ctx.db.insert('socialActionRateLimits', {
        userId: base.ownerActor.userId,
        action: 'BLOCK',
        window: 'HOUR',
        windowStartedAt: new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000).toISOString(),
        count: 30
      })
    )
    const before = await base.snapshot()
    await expect(base.ownerActor.caller.mutation(remove, input)).rejects.toThrow(
      'Too many Social actions'
    )
    expect(await base.snapshot()).toEqual(before)
    await base.t.run((ctx) => ctx.db.patch(counterId, { count: 29 }))
    const outcomes = await Promise.allSettled([
      base.ownerActor.caller.mutation(remove, input),
      base.ownerActor.caller.mutation(remove, input)
    ])
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(await base.t.run((ctx) => ctx.db.get(counterId))).toMatchObject({ count: 30 })
    expect((await base.snapshot()).blocks).toEqual([])
  })
})
