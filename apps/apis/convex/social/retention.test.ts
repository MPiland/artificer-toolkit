import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  SocialRetentionPreviewInput,
  SocialRetentionPreviewResult
} from '@artificer-toolkit/schema/api/socialRetention'
import { timestampSchema } from '@artificer-toolkit/schema/api/campaignContractSchemas'
import { fixture, snapshot } from '../../tests/fixtures/socialAdmission'
import { api } from '../_generated/api'

const preview = makeFunctionReference<
  'query',
  SocialRetentionPreviewInput,
  SocialRetentionPreviewResult
>('social/retention:preview')
const asOf = '2026-09-01T00:00:00.000Z'
const paginationOpts = { cursor: null, numItems: 8 }

async function run(
  base: Awaited<ReturnType<typeof fixture>>,
  phase: SocialRetentionPreviewInput['phase'],
  options: Partial<SocialRetentionPreviewInput> = {}
) {
  return base.t.query(preview, { phase, asOf, paginationOpts, ...options })
}

describe('social retention preview', () => {
  it('applies invitation precedence and strict 180-day eligibility without writing', async () => {
    const base = await fixture()
    const before = await snapshot(base)
    await base.t.run(async (ctx) => {
      const invite = await ctx.db
        .query('campaignInvites')
        .withIndex('by_publicId', (q) => q.eq('id', base.acceptedInviteId))
        .unique()
      if (!invite) throw new Error('Missing accepted invitation.')
      await ctx.db.patch(invite._id, {
        respondedAt: '2026-08-31T00:00:00.000Z',
        revokedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      })
    })
    const result = await run(base, 'INVITATIONS')
    expect(result).toMatchObject({ scanned: 2, eligible: 0, isDone: true })
    expect(await snapshot(base)).toEqual({
      ...before,
      invites: before.invites.map((row) =>
        row.id === base.acceptedInviteId
          ? {
              ...row,
              respondedAt: '2026-08-31T00:00:00.000Z',
              revokedAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z'
            }
          : row
      )
    })
  })

  it('keeps invitations exactly on the 180-day cutoff and permits one millisecond earlier', async () => {
    const base = await fixture()
    const cutoff = '2026-03-05T00:00:00.000Z'
    await base.t.run(async (ctx) => {
      const invite = await ctx.db
        .query('campaignInvites')
        .withIndex('by_publicId', (q) => q.eq('id', base.acceptedInviteId))
        .unique()
      if (!invite) throw new Error('Missing accepted invitation.')
      await ctx.db.patch(invite._id, { respondedAt: cutoff, updatedAt: cutoff })
    })
    expect((await run(base, 'INVITATIONS')).eligible).toBe(0)
    await base.t.run(async (ctx) => {
      const invite = await ctx.db
        .query('campaignInvites')
        .withIndex('by_publicId', (q) => q.eq('id', base.acceptedInviteId))
        .unique()
      if (!invite) throw new Error('Missing accepted invitation.')
      await ctx.db.patch(invite._id, { respondedAt: '2026-03-04T23:59:59.999Z' })
    })
    expect((await run(base, 'INVITATIONS')).eligible).toBe(1)
  })

  it('counts bounded pages and returns only preview metadata', async () => {
    const base = await fixture()
    await base.t.run(async (ctx) => {
      const invite = await ctx.db
        .query('campaignInvites')
        .withIndex('by_publicId', (q) => q.eq('id', base.acceptedInviteId))
        .unique()
      if (!invite) throw new Error('Missing accepted invitation.')
      const { _id, _creationTime, ...stored } = invite
      // Eight expired copies follow the two fixture invitations in creation order.
      for (let index = 0; index < 8; index++)
        await ctx.db.insert('campaignInvites', {
          ...stored,
          id: crypto.randomUUID(),
          respondedAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        })
    })
    const first = await run(base, 'INVITATIONS')
    expect(first).toMatchObject({ scanned: 8, eligible: 6, isDone: false })
    expect(
      Object.keys(first).every((key) =>
        ['scanned', 'eligible', 'isDone', 'continueCursor', 'splitCursor', 'pageStatus'].includes(
          key
        )
      )
    ).toBe(true)
    const second = await run(base, 'INVITATIONS', {
      paginationOpts: { cursor: first.continueCursor, numItems: 8 }
    })
    expect(second).toMatchObject({ scanned: 2, eligible: 2, isDone: true })
  })

  it.each([
    ['RESOLVED', '2024-08-31T00:00:00.000Z', asOf, 1],
    ['DISMISSED', '2024-08-31T00:00:00.000Z', asOf, 1],
    ['RESOLVED', '2022-02-28T12:34:56.789Z', '2024-02-29T12:34:56.789Z', 0],
    ['RESOLVED', '2022-02-28T12:34:56.788Z', '2024-02-29T12:34:56.789Z', 1]
  ] as const)(
    'counts %s at %s using calendar years',
    async (status, resolvedAt, cutoff, eligible) => {
      const base = await fixture()
      const profileId = await base.t.run(async (ctx) => {
        const profile = await ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
          .unique()
        if (!profile) throw new Error('Missing owner Social profile.')
        return profile.id
      })
      await base.other.caller.mutation(api.social.reports.create, {
        input: {
          targetKind: 'PROFILE',
          targetPublicId: profileId,
          reason: 'OTHER',
          details: 'Retention test report'
        }
      })
      await base.t.run(async (ctx) => {
        const report = await ctx.db.query('socialReports').first()
        if (!report) throw new Error('Missing report.')
        await ctx.db.patch(report._id, {
          status,
          resolvedAt,
          queuePriority: 2,
          createdAt: '2021-01-01T00:00:00.000Z',
          reviewStartedAt: '2021-01-02T00:00:00.000Z',
          updatedAt: resolvedAt
        })
      })
      const result = await run(base, 'REPORTS', { asOf: cutoff })
      expect(result).toMatchObject({ scanned: 1, eligible, isDone: true })
      expect(result).not.toHaveProperty('page')
      expect(result).not.toHaveProperty('reportPublicId')
    }
  )

  it('rejects oversized pages and future cutoffs', async () => {
    const base = await fixture()
    await expect(
      run(base, 'INVITATIONS', { paginationOpts: { cursor: null, numItems: 9 } })
    ).rejects.toThrow()
    await expect(run(base, 'INVITATIONS', { asOf: '2099-01-01T00:00:00.000Z' })).rejects.toThrow(
      'current or past cutoff'
    )
  })

  it('protects accepted applications with active membership and honors an old departure', async () => {
    const base = await fixture()
    await base.t.run(async (ctx) => {
      const application = await ctx.db
        .query('socialApplications')
        .withIndex('by_publicId', (q) => q.eq('id', base.acceptedApplicationId))
        .unique()
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
        )
        .unique()
      if (!application || !membership) throw new Error('Missing accepted application state.')
      await ctx.db.patch(application._id, {
        respondedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      })
    })
    expect(await run(base, 'APPLICATIONS')).toMatchObject({ scanned: 2, eligible: 0, isDone: true })
    await base.t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
        )
        .unique()
      if (!membership) throw new Error('Missing membership.')
      await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: '2026-01-02T00:00:00.000Z' })
    })
    expect(await run(base, 'APPLICATIONS')).toMatchObject({ scanned: 2, eligible: 1, isDone: true })
    const receipt = await base.owner.caller.mutation(api.social.reports.create, {
      input: {
        targetKind: 'APPLICATION',
        targetPublicId: base.acceptedApplicationId,
        reason: 'OTHER',
        details: 'Application retention report'
      }
    })
    await base.t.run(async (ctx) => {
      const report = await ctx.db
        .query('socialReports')
        .withIndex('by_publicId', (q) => q.eq('id', receipt.reportPublicId))
        .unique()
      if (!report) throw new Error('Missing application report.')
      await ctx.db.patch(report._id, {
        status: 'RESOLVED',
        queuePriority: 2,
        reviewStartedAt: '2024-01-01T00:00:00.000Z',
        resolvedAt: '2024-08-31T00:00:00.000Z'
      })
    })
    expect((await run(base, 'APPLICATIONS')).eligible).toBe(1)
    for (const [resolvedAt, eligible] of [
      ['2024-09-01T00:00Z', 1],
      ['2024-09-01T00:00:30Z', 1],
      ['2024-09-01T00:00:30.0Z', 1],
      ['2024-09-01T00:00:30.05Z', 1],
      ['2024-09-01T00:00:30.050999Z', 1],
      ['2024-09-01T00:00:30.051000Z', 0],
      ['2024-09-01T00:00:30.1Z', 0]
    ] as const) {
      expect(timestampSchema.safeParse(resolvedAt).success).toBe(true)
      await base.t.run(async (ctx) => {
        const report = await ctx.db
          .query('socialReports')
          .withIndex('by_publicId', (q) => q.eq('id', receipt.reportPublicId))
          .unique()
        if (!report) throw new Error('Missing application report.')
        await ctx.db.patch(report._id, { resolvedAt })
      })
      expect((await run(base, 'APPLICATIONS', { asOf: '2026-09-01T00:00:30.051Z' })).eligible).toBe(
        eligible
      )
    }
    await base.t.run(async (ctx) => {
      const report = await ctx.db
        .query('socialReports')
        .withIndex('by_publicId', (q) => q.eq('id', receipt.reportPublicId))
        .unique()
      if (!report) throw new Error('Missing application report.')
      await ctx.db.patch(report._id, {
        status: 'SUBMITTED',
        queuePriority: 0,
        reviewStartedAt: null,
        resolvedAt: null
      })
    })
    expect((await run(base, 'APPLICATIONS')).eligible).toBe(0)
  })
})
